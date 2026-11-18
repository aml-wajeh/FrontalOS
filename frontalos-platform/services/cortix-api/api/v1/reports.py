"""
Real PDF report generation, replacing the old endpoint that returned a
fake `"download_url": "/api/v1/downloads/report_{id}.pdf"` string pointing
at a file that was never created. This one actually builds and streams a
PDF.
"""
import io
from datetime import datetime, timedelta

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    Image as RLImage,
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from sqlalchemy.orm import Session

from database.session import get_db
from database.models import Patient, AIPrediction, CheckIn

router = APIRouter(prefix="/reports", tags=["Reports"])


def _get_patient_or_404(db: Session, patient_id: int) -> Patient:
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if patient is None:
        raise HTTPException(status_code=404, detail=f"Patient {patient_id} not found")
    return patient


def _render_30day_chart(checkins: list[CheckIn]) -> bytes:
    fig, ax = plt.subplots(figsize=(6.5, 2.6), dpi=150)
    if checkins:
        dates = [c.created_at for c in checkins]
        attention = [c.attention_score for c in checkins]
        ax.plot(dates, attention, marker="o", linewidth=1.5, color="#1B2340")
        ax.set_ylabel("Attention score")
        ax.set_title("30-Day Attention Trend")
        fig.autofmt_xdate(rotation=30)
    else:
        ax.text(0.5, 0.5, "No check-in data available for this window", ha="center", va="center")
        ax.axis("off")
    buf = io.BytesIO()
    fig.tight_layout()
    fig.savefig(buf, format="png")
    plt.close(fig)
    buf.seek(0)
    return buf.read()


@router.get("/generate/{patient_id}")
def generate_report(
    patient_id: int,
    format: str = Query("pdf", pattern="^(pdf)$"),
    report_type: str = "clinical",
    db: Session = Depends(get_db),
):
    patient = _get_patient_or_404(db, patient_id)

    since = datetime.utcnow() - timedelta(days=30)
    checkins = (
        db.query(CheckIn)
        .filter(CheckIn.patient_id == patient_id, CheckIn.created_at >= since)
        .order_by(CheckIn.created_at.asc())
        .all()
    )
    predictions = (
        db.query(AIPrediction)
        .filter(AIPrediction.patient_id == patient_id)
        .order_by(AIPrediction.created_at.desc())
        .limit(5)
        .all()
    )

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=letter, topMargin=0.6 * inch, bottomMargin=0.6 * inch)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("CortixTitle", parent=styles["Title"], textColor=colors.HexColor("#1B2340"))
    h2 = ParagraphStyle("CortixH2", parent=styles["Heading2"], textColor=colors.HexColor("#1B2340"))
    normal = styles["Normal"]
    small = ParagraphStyle("Small", parent=styles["Normal"], fontSize=8, textColor=colors.grey)

    story = []

    # --- Header -----------------------------------------------------------
    # NOTE: no CORTIX logo asset ships in this repo; placeholder text stands
    # in for it. Drop a real logo file at services/cortix-api/assets/logo.png
    # and swap this Paragraph for RLImage(logo_path, ...) once available.
    story.append(Paragraph("[ CORTIX LOGO PLACEHOLDER ]", small))
    story.append(Paragraph("CORTIX Clinical Progress Report", title_style))
    story.append(Paragraph(f"Report type: {report_type.title()} &nbsp;|&nbsp; Generated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}", normal))
    story.append(Spacer(1, 0.2 * inch))

    # --- Patient info -------------------------------------------------------
    story.append(Paragraph("Patient Information", h2))
    info_table = Table(
        [
            ["Name", patient.name],
            ["Age", str(patient.age)],
            ["Gender", patient.gender],
            ["Patient ID", str(patient.id)],
        ],
        colWidths=[1.5 * inch, 4 * inch],
    )
    info_table.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#1B2340")),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(info_table)
    story.append(Spacer(1, 0.2 * inch))

    # --- Latest AI predictions ----------------------------------------------
    story.append(Paragraph("Latest AI Predictions", h2))
    if predictions:
        rows = [["Date", "Model", "Result", "Confidence", "Mode"]]
        for p in predictions:
            result = p.prediction_result or {}
            mode = result.get("inference_mode", "unknown")
            if p.model_type == "tabular":
                summary = f"risk={result.get('risk_level', '?')}"
            else:
                summary = f"ADHD prob={result.get('adhd_probability_pct', '?')}%"
            rows.append([
                p.created_at.strftime("%Y-%m-%d"),
                p.model_type,
                summary,
                f"{p.confidence:.2f}",
                mode.upper(),
            ])
        pred_table = Table(rows, colWidths=[1.1 * inch, 0.9 * inch, 1.8 * inch, 1 * inch, 0.8 * inch])
        pred_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1B2340")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("GRID", (0, 0), (-1, -1), 0.4, colors.lightgrey),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ]))
        story.append(pred_table)
    else:
        story.append(Paragraph("No AI predictions recorded for this patient yet.", normal))
    story.append(Spacer(1, 0.25 * inch))

    # --- 30-day chart ---------------------------------------------------------
    story.append(Paragraph("30-Day Progress Chart", h2))
    chart_bytes = _render_30day_chart(checkins)
    story.append(RLImage(io.BytesIO(chart_bytes), width=6.3 * inch, height=2.5 * inch))
    story.append(Spacer(1, 0.3 * inch))

    # --- Footer disclaimer -----------------------------------------------------
    story.append(Spacer(1, 0.4 * inch))
    story.append(Paragraph(
        "Disclaimer: This report is generated by CORTIX for care-team review and "
        "does not constitute a standalone medical diagnosis. AI predictions in "
        "\"DEMO\" mode are placeholder outputs from a heuristic simulator, not a "
        "trained clinical model, and must not be used for any clinical decision.",
        small,
    ))

    doc.build(story)
    buf.seek(0)

    filename = f"cortix_report_patient_{patient_id}.pdf"
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
