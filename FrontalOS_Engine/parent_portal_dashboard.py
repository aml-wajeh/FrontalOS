"""
Parent Portal — ADHD Digital Therapeutics Platform
----------------------------------------------------
A Streamlit dashboard showing one child's 30-day progress trend.

Run with:
    streamlit run parent_portal_dashboard.py

Data:
    Looks for a per-patient TIME-SERIES file (must include a `Date` column
    plus Focus_Score_Video, Sleep_Hours, Daily_Phone_Usage_Hours) at
    ./adhd_timeseries.csv. If it isn't found, the app falls back to
    simulated 30-day demo data for one patient, grounded in the value
    ranges observed in the provided adhd_data.csv (a 6,500-row
    cross-sectional survey — one row per child, no dates — which is why
    it can't itself supply a single child's daily trend).
"""

import numpy as np
import pandas as pd
import streamlit as st
import plotly.graph_objects as go
from datetime import datetime, timedelta

# ----------------------------------------------------------------------
# PAGE CONFIG & THEME
# ----------------------------------------------------------------------
st.set_page_config(
    page_title="Parent Portal | Focus & Wellbeing",
    page_icon="🧠",
    layout="wide",
    initial_sidebar_state="expanded",
)

PRIMARY = "#4F6BFF"       # focus / brand blue
SECONDARY = "#00C2A8"     # sleep / teal accent
BG_CARD = "#FFFFFF"
INK = "#1B2340"
MUTED = "#6B7280"
BG_PAGE = "#F5F7FB"

st.markdown(
    f"""
    <style>
    .stApp {{
        background-color: {BG_PAGE};
    }}
    #MainMenu, footer {{visibility: hidden;}}

    .portal-header {{
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 1.1rem 1.6rem;
        background: linear-gradient(135deg, {PRIMARY} 0%, #7C8DFF 100%);
        border-radius: 18px;
        color: white;
        margin-bottom: 1.4rem;
        box-shadow: 0 8px 24px rgba(79,107,255,0.25);
    }}
    .portal-header h1 {{
        font-size: 1.5rem;
        margin: 0;
        font-weight: 700;
    }}
    .portal-header p {{
        margin: 0.15rem 0 0 0;
        opacity: 0.9;
        font-size: 0.92rem;
    }}

    .metric-card {{
        background: {BG_CARD};
        border-radius: 16px;
        padding: 1.1rem 1.3rem;
        box-shadow: 0 2px 10px rgba(27,35,64,0.06);
        border: 1px solid #ECEFF6;
    }}
    .metric-label {{
        color: {MUTED};
        font-size: 0.82rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        margin-bottom: 0.3rem;
    }}
    .metric-value {{
        color: {INK};
        font-size: 1.9rem;
        font-weight: 700;
        line-height: 1.1;
    }}
    .metric-delta-up {{ color: #12B76A; font-weight: 600; font-size: 0.85rem; }}
    .metric-delta-down {{ color: #F04438; font-weight: 600; font-size: 0.85rem; }}

    .section-title {{
        font-size: 1.05rem;
        font-weight: 700;
        color: {INK};
        margin: 1.6rem 0 0.4rem 0;
    }}
    .section-caption {{
        color: {MUTED};
        font-size: 0.85rem;
        margin-bottom: 0.6rem;
    }}
    .disclaimer-box {{
        background: #FFF8E6;
        border: 1px solid #F5D98B;
        border-radius: 12px;
        padding: 0.8rem 1rem;
        font-size: 0.83rem;
        color: #7A5B00;
        margin-top: 0.4rem;
    }}
    .demo-badge {{
        display:inline-block;
        background:#EEF1FF;
        color:{PRIMARY};
        font-size:0.72rem;
        font-weight:700;
        padding:2px 10px;
        border-radius:999px;
        margin-left:8px;
        vertical-align:middle;
    }}
    </style>
    """,
    unsafe_allow_html=True,
)

# ----------------------------------------------------------------------
# DATA LOADING
# ----------------------------------------------------------------------
@st.cache_data
def load_reference_ranges(path="adhd_data.csv"):
    """Pull realistic value ranges from the cohort survey file, if present."""
    try:
        df = pd.read_csv(path)
        return {
            "sleep_mean": float(df["Sleep_Hours"].mean()),
            "sleep_std": float(df["Sleep_Hours"].std()),
            "focus_mean": float(df["Focus_Score_Video"].mean()),
            "focus_std": float(df["Focus_Score_Video"].std()),
            "focus_min": float(df["Focus_Score_Video"].min()),
            "focus_max": float(df["Focus_Score_Video"].max()),
            "phone_mean": float(df["Daily_Phone_Usage_Hours"].mean()),
            "phone_std": float(df["Daily_Phone_Usage_Hours"].std()),
        }
    except Exception:
        return None


@st.cache_data
def load_patient_timeseries(path="adhd_timeseries.csv"):
    """Load a real per-patient daily time series if one has been provided."""
    try:
        df = pd.read_csv(path, parse_dates=["Date"])
        required = {"Date", "Focus_Score_Video", "Sleep_Hours", "Daily_Phone_Usage_Hours"}
        if required.issubset(df.columns):
            return df.sort_values("Date").reset_index(drop=True)
        return None
    except Exception:
        return None


@st.cache_data
def simulate_patient_timeseries(days=30, seed=42, ranges=None):
    """Generate a realistic 30-day demo trend for a single patient.

    Sleep and focus are simulated with a built-in association (better sleep
    -> generally better next-day focus, plus noise) purely for
    demonstration purposes. This is NOT derived from real patient data.
    """
    rng = np.random.default_rng(seed)
    dates = [datetime.today().date() - timedelta(days=days - 1 - i) for i in range(days)]

    sleep_mean = ranges["sleep_mean"] if ranges else 7.5
    sleep_std = min(ranges["sleep_std"], 1.4) if ranges else 1.2
    focus_min = ranges["focus_min"] if ranges else 0
    focus_max = ranges["focus_max"] if ranges else 10
    phone_mean = ranges["phone_mean"] if ranges else 1.1
    phone_std = ranges["phone_std"] if ranges else 0.4

    sleep_hours = np.clip(rng.normal(sleep_mean, sleep_std, days), 3, 12)
    phone_usage = np.clip(rng.normal(phone_mean, phone_std, days), 0.2, 3.5)

    # Simulated relationship: focus rises with sleep, dips slightly with phone use,
    # with a gentle overall upward trend (therapeutic program effect) + noise.
    baseline = (focus_max - focus_min) / 2
    trend = np.linspace(-0.6, 1.4, days)  # slow improvement over the month
    sleep_effect = (sleep_hours - sleep_mean) * 0.55
    phone_effect = (phone_usage - phone_mean) * -0.7
    noise = rng.normal(0, 0.9, days)

    focus_score = baseline + trend + sleep_effect + phone_effect + noise
    focus_score = np.clip(focus_score, focus_min, focus_max)

    df = pd.DataFrame(
        {
            "Date": dates,
            "Sleep_Hours": np.round(sleep_hours, 1),
            "Focus_Score_Video": np.round(focus_score, 1),
            "Daily_Phone_Usage_Hours": np.round(phone_usage, 2),
        }
    )
    return df


ranges = load_reference_ranges("adhd_data.csv")
real_ts = load_patient_timeseries("adhd_timeseries.csv")
using_demo_data = real_ts is None
patient_df = real_ts if real_ts is not None else simulate_patient_timeseries(30, seed=42, ranges=ranges)

# ----------------------------------------------------------------------
# SIDEBAR
# ----------------------------------------------------------------------
with st.sidebar:
    st.markdown("### 👤 Patient")
    st.markdown("**Alex M.** · Age 9 · Program Week 5")
    st.markdown("---")
    st.markdown("### 📅 Date range")
    n_days = st.slider("Days to display", min_value=7, max_value=len(patient_df), value=len(patient_df))
    st.markdown("---")
    st.markdown("### About this view")
    st.caption(
        "This portal summarizes daily app-session data collected during "
        "your child's therapeutic activities. It's designed to help you "
        "spot trends — not to replace guidance from your clinician."
    )
    if using_demo_data:
        st.info("Showing **simulated demo data**. Connect a real per-patient "
                "daily feed (with a `Date` column) to replace it.", icon="🧪")

view_df = patient_df.tail(n_days).reset_index(drop=True)

# ----------------------------------------------------------------------
# HEADER
# ----------------------------------------------------------------------
badge = '<span class="demo-badge">DEMO DATA</span>' if using_demo_data else ""
st.markdown(
    f"""
    <div class="portal-header">
        <div>
            <h1>Alex's Focus & Wellbeing Journey {badge}</h1>
            <p>Last {n_days} days · Updated {datetime.today().strftime('%B %d, %Y')}</p>
        </div>
        <div style="font-size:2.2rem;">🧠✨</div>
    </div>
    """,
    unsafe_allow_html=True,
)

# ----------------------------------------------------------------------
# KPI SECTION
# ----------------------------------------------------------------------
avg_phone = view_df["Daily_Phone_Usage_Hours"].mean()
avg_focus = view_df["Focus_Score_Video"].mean()
avg_sleep = view_df["Sleep_Hours"].mean()

first_half_focus = view_df["Focus_Score_Video"].iloc[: len(view_df) // 2].mean()
second_half_focus = view_df["Focus_Score_Video"].iloc[len(view_df) // 2 :].mean()
focus_delta = second_half_focus - first_half_focus

first_half_phone = view_df["Daily_Phone_Usage_Hours"].iloc[: len(view_df) // 2].mean()
second_half_phone = view_df["Daily_Phone_Usage_Hours"].iloc[len(view_df) // 2 :].mean()
phone_delta = second_half_phone - first_half_phone

col1, col2, col3 = st.columns(3)

with col1:
    delta_class = "metric-delta-up" if focus_delta >= 0 else "metric-delta-down"
    arrow = "▲" if focus_delta >= 0 else "▼"
    st.markdown(
        f"""
        <div class="metric-card">
            <div class="metric-label">Average Study Focus Score</div>
            <div class="metric-value">{avg_focus:.1f} / 10</div>
            <div class="{delta_class}">{arrow} {abs(focus_delta):.1f} vs. first half of period</div>
        </div>
        """,
        unsafe_allow_html=True,
    )

with col2:
    delta_class = "metric-delta-down" if phone_delta > 0 else "metric-delta-up"
    arrow = "▲" if phone_delta > 0 else "▼"
    st.markdown(
        f"""
        <div class="metric-card">
            <div class="metric-label">Average Phone Usage</div>
            <div class="metric-value">{avg_phone:.1f} hrs/day</div>
            <div class="{delta_class}">{arrow} {abs(phone_delta):.1f} hrs vs. first half of period</div>
        </div>
        """,
        unsafe_allow_html=True,
    )

with col3:
    st.markdown(
        f"""
        <div class="metric-card">
            <div class="metric-label">Average Sleep</div>
            <div class="metric-value">{avg_sleep:.1f} hrs/night</div>
            <div style="color:{MUTED}; font-size:0.85rem;">Pediatric guideline: 9–11 hrs (ages 6–12)</div>
        </div>
        """,
        unsafe_allow_html=True,
    )

# ----------------------------------------------------------------------
# CHART 1 — FOCUS SCORE TREND
# ----------------------------------------------------------------------
st.markdown('<div class="section-title">📈 Focus Score Trend</div>', unsafe_allow_html=True)
st.markdown(
    '<div class="section-caption">Video-task focus score recorded during each session, over time.</div>',
    unsafe_allow_html=True,
)

fig_focus = go.Figure()
fig_focus.add_trace(
    go.Scatter(
        x=view_df["Date"],
        y=view_df["Focus_Score_Video"],
        mode="lines+markers",
        name="Focus Score",
        line=dict(color=PRIMARY, width=3, shape="spline"),
        marker=dict(size=6, color=PRIMARY),
        fill="tozeroy",
        fillcolor="rgba(79,107,255,0.08)",
        hovertemplate="%{x|%b %d}<br>Focus Score: %{y:.1f}<extra></extra>",
    )
)
# 7-day rolling average to show the underlying trend
if len(view_df) >= 3:
    roll = view_df["Focus_Score_Video"].rolling(window=min(7, len(view_df)), min_periods=1).mean()
    fig_focus.add_trace(
        go.Scatter(
            x=view_df["Date"],
            y=roll,
            mode="lines",
            name="7-day average",
            line=dict(color=SECONDARY, width=2, dash="dot"),
            hovertemplate="%{x|%b %d}<br>7-day avg: %{y:.1f}<extra></extra>",
        )
    )

fig_focus.update_layout(
    plot_bgcolor="white",
    paper_bgcolor="white",
    height=380,
    margin=dict(l=10, r=10, t=10, b=10),
    legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
    xaxis=dict(showgrid=False, tickfont=dict(color=MUTED)),
    yaxis=dict(title="Focus Score", showgrid=True, gridcolor="#EEF0F6", tickfont=dict(color=MUTED)),
    font=dict(family="Helvetica, Arial", color=INK),
)
st.plotly_chart(fig_focus, use_container_width=True)

# ----------------------------------------------------------------------
# CHART 2 — SLEEP VS FOCUS (DUAL AXIS)
# ----------------------------------------------------------------------
st.markdown('<div class="section-title">😴 Sleep & Focus — How They Move Together</div>', unsafe_allow_html=True)
st.markdown(
    '<div class="section-caption">Nightly sleep duration alongside the next day\'s focus score.</div>',
    unsafe_allow_html=True,
)

corr = view_df["Sleep_Hours"].corr(view_df["Focus_Score_Video"])

fig_dual = go.Figure()
fig_dual.add_trace(
    go.Bar(
        x=view_df["Date"],
        y=view_df["Sleep_Hours"],
        name="Sleep Hours",
        marker_color="rgba(0,194,168,0.35)",
        yaxis="y1",
        hovertemplate="%{x|%b %d}<br>Sleep: %{y:.1f} hrs<extra></extra>",
    )
)
fig_dual.add_trace(
    go.Scatter(
        x=view_df["Date"],
        y=view_df["Focus_Score_Video"],
        name="Focus Score",
        mode="lines+markers",
        line=dict(color=PRIMARY, width=3),
        marker=dict(size=6),
        yaxis="y2",
        hovertemplate="%{x|%b %d}<br>Focus Score: %{y:.1f}<extra></extra>",
    )
)
fig_dual.update_layout(
    plot_bgcolor="white",
    paper_bgcolor="white",
    height=400,
    margin=dict(l=10, r=10, t=10, b=10),
    legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
    xaxis=dict(showgrid=False, tickfont=dict(color=MUTED)),
    yaxis=dict(
        title="Sleep (hrs)",
        side="left",
        showgrid=False,
        tickfont=dict(color=SECONDARY),
        title_font=dict(color=SECONDARY),
    ),
    yaxis2=dict(
        title="Focus Score",
        side="right",
        overlaying="y",
        showgrid=False,
        tickfont=dict(color=PRIMARY),
        title_font=dict(color=PRIMARY),
    ),
    font=dict(family="Helvetica, Arial", color=INK),
)
st.plotly_chart(fig_dual, use_container_width=True)

st.markdown(
    f"""
    <div class="disclaimer-box">
        📊 <b>Correlation, not proof of causation:</b> over this period, sleep and focus
        moved together with a correlation coefficient of <b>{corr:.2f}</b>
        {"(a fairly strong positive relationship)" if corr > 0.5 else "(a modest relationship)" if corr > 0.2 else "(a weak relationship)"}.
        That's a useful pattern to discuss with your child's clinician, but a two-variable
        trend line like this can't establish that poor sleep <i>causes</i> lower focus —
        other factors (stress, medication timing, school schedule, etc.) could be involved too.
    </div>
    """,
    unsafe_allow_html=True,
)

# ----------------------------------------------------------------------
# FOOTER
# ----------------------------------------------------------------------
st.markdown("<br>", unsafe_allow_html=True)
st.caption(
    "This dashboard is for care coordination and progress tracking. It is not a "
    "diagnostic tool. Please discuss any concerning trends with your care team."
)
