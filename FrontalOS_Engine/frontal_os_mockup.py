"""
FrontalOS by Cortix — ADHD Digital Therapeutics Platform
Enterprise Mockup Dashboard (Single-file Streamlit application)
"""

import streamlit as st
import plotly.graph_objects as go
import numpy as np
import pandas as pd
import datetime
import random

# ============================================================================
# PAGE CONFIG
# ============================================================================
st.set_page_config(
    page_title="FrontalOS | Cortix Enterprise Platform",
    page_icon="🧠",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ============================================================================
# BRAND DESIGN SYSTEM — GLOBAL CSS
# ============================================================================
BASE_CSS = """
<style>
:root{
    --cortix-navy:#1B2340;
    --cortix-teal:#00C2A8;
    --cortix-amber:#F4A261;
    --cortix-bg-light:#F5F7FB;
    --cortix-bg-dark:#10172A;
    --cortix-card:#FFFFFF;
}

@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;600;700&display=swap');

html, body, [class*="css"]  {
    font-family: 'Inter', -apple-system, sans-serif;
}

#MainMenu {visibility: hidden;}
footer {visibility: hidden;}
header {visibility: hidden;}

.stApp {
    background: var(--cortix-bg-light);
}

/* Sidebar */
section[data-testid="stSidebar"] {
    background: linear-gradient(180deg, #1B2340 0%, #141B33 100%);
    border-right: 1px solid rgba(255,255,255,0.06);
}
section[data-testid="stSidebar"] * {
    color: #E7EAF6 !important;
}
section[data-testid="stSidebar"] .stRadio label {
    font-weight: 500;
}
.sidebar-logo {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 26px;
    font-weight: 700;
    color: #FFFFFF !important;
    letter-spacing: -0.5px;
    padding: 6px 0 0 0;
}
.sidebar-sub {
    font-size: 11px;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: #7C88B8 !important;
    margin-bottom: 22px;
}
.sidebar-divider {
    height: 1px;
    background: rgba(255,255,255,0.08);
    margin: 14px 0 18px 0;
}
.sidebar-footer {
    font-size: 11px;
    color: #5C6790 !important;
    margin-top: 24px;
}

/* Generic card */
.cx-card {
    background: var(--cortix-card);
    border-radius: 14px;
    padding: 22px 24px;
    box-shadow: 0 4px 18px rgba(27,35,64,0.06);
    border: 1px solid rgba(27,35,64,0.04);
    margin-bottom: 18px;
}

/* Section header */
.cx-section-title {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 22px;
    font-weight: 700;
    color: var(--cortix-navy);
    margin-bottom: 2px;
}
.cx-section-sub {
    font-size: 13.5px;
    color: #6B7592;
    margin-bottom: 18px;
}

/* Pill badge */
.cx-badge {
    display:inline-block;
    padding: 4px 12px;
    border-radius: 999px;
    font-size: 11.5px;
    font-weight: 700;
    letter-spacing: 0.4px;
    text-transform: uppercase;
}
.cx-badge-teal { background: rgba(0,194,168,0.14); color:#00967F; }
.cx-badge-amber { background: rgba(244,162,97,0.16); color:#B5651D; }
.cx-badge-navy { background: rgba(27,35,64,0.08); color: var(--cortix-navy); }

hr.cx-hr { border: none; border-top: 1px solid rgba(27,35,64,0.08); margin: 22px 0; }
</style>
"""
st.markdown(BASE_CSS, unsafe_allow_html=True)

# ============================================================================
# SIDEBAR NAVIGATION
# ============================================================================
with st.sidebar:
    st.markdown('<div class="sidebar-logo">🧠 FrontalOS</div>', unsafe_allow_html=True)
    st.markdown('<div class="sidebar-sub">Cortix Enterprise Suite</div>', unsafe_allow_html=True)
    st.markdown('<div class="sidebar-divider"></div>', unsafe_allow_html=True)

    portal = st.radio(
        "Select Portal",
        ["🎮 Patient Portal", "📊 Parent Command Center", "🏥 Clinical Portal (Dr. Tarek)"],
        label_visibility="collapsed",
    )

    st.markdown('<div class="sidebar-divider"></div>', unsafe_allow_html=True)
    st.markdown("**Active Patient**")
    st.markdown("Ethan Whitfield · Age 13")
    st.markdown('<span class="cx-badge cx-badge-teal">TREATMENT WEEK 6</span>', unsafe_allow_html=True)
    st.markdown('<div class="sidebar-divider"></div>', unsafe_allow_html=True)
    st.markdown('<div class="sidebar-footer">FrontalOS Enterprise v3.2.1<br>HIPAA-compliant environment<br>© Cortix Neurotechnologies</div>', unsafe_allow_html=True)


# ============================================================================
# SHARED MOCK DATA GENERATORS
# ============================================================================
@st.cache_data
def gen_30day_data(seed=42):
    rng = np.random.default_rng(seed)
    dates = pd.date_range(end=datetime.date.today(), periods=30)
    sleep = np.clip(rng.normal(7.1, 1.1, 30), 4.2, 9.5)
    focus = np.clip(30 + sleep * 8 + rng.normal(0, 6, 30), 20, 98)
    return pd.DataFrame({"date": dates, "sleep_hours": sleep, "focus_score": focus})

data30 = gen_30day_data()


# ============================================================================
# PORTAL 1 — PATIENT PORTAL (Gamified Teen Theme)
# ============================================================================
def render_patient_portal():
    st.markdown("""
    <style>
    .game-stat {
        background: linear-gradient(135deg, #1B2340 0%, #2A3564 100%);
        border-radius: 16px;
        padding: 20px;
        color: white;
        text-align: center;
        box-shadow: 0 8px 24px rgba(27,35,64,0.25);
        border: 1px solid rgba(0,194,168,0.25);
    }
    .game-stat .val { font-family:'Space Grotesk',sans-serif; font-size: 34px; font-weight:800; color:#00C2A8; }
    .game-stat .lbl { font-size: 12px; text-transform:uppercase; letter-spacing:1.5px; color:#AEB8E0; margin-top:4px;}
    .coin-banner {
        background: linear-gradient(90deg, #F4A261 0%, #FFC98B 100%);
        border-radius: 14px;
        padding: 16px 24px;
        color: #1B2340;
        font-weight: 800;
        font-size: 20px;
        display:flex; justify-content:space-between; align-items:center;
        box-shadow: 0 6px 18px rgba(244,162,97,0.35);
        margin-bottom: 20px;
    }
    .ai-observer {
        background: #0A0F1E;
        border-radius: 14px;
        padding: 18px;
        border: 2px solid #00C2A8;
        position: relative;
        overflow:hidden;
    }
    .ai-observer::before {
        content: "● REC";
        position:absolute; top:14px; right:18px;
        color:#FF5C5C; font-size:11px; font-weight:700; letter-spacing:1px;
    }
    .obs-metric-row { display:flex; justify-content:space-between; margin-top:10px; }
    .obs-bar-bg { background:#1B2340; border-radius:8px; height:10px; width:100%; overflow:hidden; margin-top:4px;}
    .obs-bar-fill { height:10px; border-radius:8px; }
    .dopa-card {
        background:white; border-radius:14px; padding:18px; text-align:center;
        box-shadow:0 4px 14px rgba(27,35,64,0.08); border:1px solid rgba(0,194,168,0.15);
        transition: transform .2s;
    }
    .dopa-card:hover { transform: translateY(-4px); }
    .dopa-emoji { font-size: 40px; }
    .dopa-title { font-weight:700; color:#1B2340; margin-top:6px; font-size:15px;}
    .dopa-coins { color:#B5651D; font-weight:700; font-size:13px; margin-top:4px;}
    </style>
    """, unsafe_allow_html=True)

    st.markdown('<div class="cx-section-title">Hey Ethan 👋 Ready to level up?</div>', unsafe_allow_html=True)
    st.markdown('<div class="cx-section-sub">Your focus quest is live. Keep your streak going!</div>', unsafe_allow_html=True)

    st.markdown("""
    <div class="coin-banner">
        <div>🪙 Coin Balance: <span style="font-size:26px;">1,240</span></div>
        <div>🔥 Streak: 9 Days</div>
        <div>🏆 Level 7 Focus Ninja</div>
    </div>
    """, unsafe_allow_html=True)

    c1, c2, c3, c4 = st.columns(4)
    stats = [("⚡", "412", "XP Today"), ("🎯", "88%", "Task Accuracy"), ("⏱️", "34m", "Focus Streak"), ("🌟", "3", "Badges Unlocked")]
    for col, (icon, val, lbl) in zip([c1, c2, c3, c4], stats):
        with col:
            st.markdown(f'<div class="game-stat"><div>{icon}</div><div class="val">{val}</div><div class="lbl">{lbl}</div></div>', unsafe_allow_html=True)

    st.markdown('<hr class="cx-hr">', unsafe_allow_html=True)

    lcol, rcol = st.columns([1.1, 1])
    with lcol:
        st.markdown('<div class="cx-section-title" style="font-size:19px;">🔴 Live AI Observer</div>', unsafe_allow_html=True)
        engagement = random.randint(68, 96)
        boredom = random.randint(4, 30)
        confusion = random.randint(2, 22)
        st.markdown(f"""
        <div class="ai-observer">
            <div style="color:#00C2A8; font-size:12px; letter-spacing:1px; font-weight:700;">📹 WEBCAM FEED — VISION AI ACTIVE</div>
            <div style="background:#111A33; height:150px; border-radius:10px; margin-top:10px; display:flex; align-items:center; justify-content:center; color:#3E4A78; font-size:13px;">
                [ Simulated Camera Frame — Face Landmarks Tracking ]
            </div>
            <div class="obs-metric-row"><span style="color:#AEB8E0; font-size:13px;">Engagement</span><span style="color:#00C2A8; font-weight:700;">{engagement}%</span></div>
            <div class="obs-bar-bg"><div class="obs-bar-fill" style="width:{engagement}%; background:#00C2A8;"></div></div>
            <div class="obs-metric-row"><span style="color:#AEB8E0; font-size:13px;">Boredom</span><span style="color:#F4A261; font-weight:700;">{boredom}%</span></div>
            <div class="obs-bar-bg"><div class="obs-bar-fill" style="width:{boredom}%; background:#F4A261;"></div></div>
            <div class="obs-metric-row"><span style="color:#AEB8E0; font-size:13px;">Confusion</span><span style="color:#FF6B6B; font-weight:700;">{confusion}%</span></div>
            <div class="obs-bar-bg"><div class="obs-bar-fill" style="width:{confusion}%; background:#FF6B6B;"></div></div>
        </div>
        """, unsafe_allow_html=True)

    with rcol:
        st.markdown('<div class="cx-section-title" style="font-size:19px;">🍬 Dopamine Menu</div>', unsafe_allow_html=True)
        st.markdown('<div class="cx-section-sub">Pick a quick reset — earn coins instantly.</div>', unsafe_allow_html=True)
        menu = [
            ("🧩", "Break Task Into 3", "+15"),
            ("👁️", "2-Min Eye Game", "+10"),
            ("🌬️", "Box Breathing", "+8"),
            ("🕺", "60s Dance Reset", "+12"),
        ]
        mc1, mc2 = st.columns(2)
        for i, (emoji, title, coins) in enumerate(menu):
            col = mc1 if i % 2 == 0 else mc2
            with col:
                st.markdown(f"""
                <div class="dopa-card">
                    <div class="dopa-emoji">{emoji}</div>
                    <div class="dopa-title">{title}</div>
                    <div class="dopa-coins">🪙 {coins} coins</div>
                </div>
                """, unsafe_allow_html=True)
                st.button("Start", key=f"dopa_{i}", use_container_width=True)


# ============================================================================
# PORTAL 2 — PARENT COMMAND CENTER
# ============================================================================
def render_parent_portal():
    st.markdown("""
    <style>
    .kpi-card {
        background: white;
        border-radius: 14px;
        padding: 20px 22px;
        box-shadow: 0 4px 18px rgba(27,35,64,0.07);
        border-left: 5px solid var(--cortix-teal);
    }
    .kpi-label { font-size:12.5px; color:#6B7592; text-transform:uppercase; letter-spacing:1px; font-weight:600; }
    .kpi-value { font-family:'Space Grotesk',sans-serif; font-size:32px; font-weight:800; color:#1B2340; margin-top:4px;}
    .kpi-delta { font-size:12.5px; font-weight:700; margin-top:6px; }
    .kpi-delta.up { color:#0DA37F; }
    .kpi-delta.down { color:#E0685A; }
    .forecast-box {
        background: linear-gradient(135deg, #1B2340 0%, #26325C 100%);
        border-radius: 16px; padding: 26px; color:white;
        box-shadow: 0 10px 26px rgba(27,35,64,0.25);
    }
    </style>
    """, unsafe_allow_html=True)

    st.markdown('<div class="cx-section-title">Parent Command Center</div>', unsafe_allow_html=True)
    st.markdown('<div class="cx-section-sub">30-day behavioral & physiological overview for Ethan Whitfield.</div>', unsafe_allow_html=True)

    k1, k2, k3, k4 = st.columns(4)
    kpis = [
        ("Focus Score (7d avg)", "76.4", "+4.2% vs last week", "up", "#00C2A8"),
        ("Sleep (avg hrs/night)", "7.3h", "+0.4h vs last week", "up", "#F4A261"),
        ("Medication Adherence", "94%", "-2% vs last week", "down", "#1B2340"),
        ("Earned Coins (7d)", "2,180", "+610 vs last week", "up", "#00C2A8"),
    ]
    for col, (lbl, val, delta, direction, accent) in zip([k1, k2, k3, k4], kpis):
        with col:
            st.markdown(f"""
            <div class="kpi-card" style="border-left-color:{accent};">
                <div class="kpi-label">{lbl}</div>
                <div class="kpi-value">{val}</div>
                <div class="kpi-delta {direction}">{'▲' if direction=='up' else '▼'} {delta}</div>
            </div>
            """, unsafe_allow_html=True)

    st.markdown('<hr class="cx-hr">', unsafe_allow_html=True)

    ccol, fcol = st.columns([2.1, 1])
    with ccol:
        st.markdown('<div class="cx-card">', unsafe_allow_html=True)
        st.markdown('<div class="cx-section-title" style="font-size:18px;">Sleep vs. Vision-AI Focus Score — 30 Day Trend</div>', unsafe_allow_html=True)

        fig = go.Figure()
        fig.add_trace(go.Bar(
            x=data30["date"], y=data30["sleep_hours"],
            name="Sleep Hours", marker_color="rgba(27,35,64,0.75)",
            yaxis="y1", opacity=0.85,
        ))
        fig.add_trace(go.Scatter(
            x=data30["date"], y=data30["focus_score"],
            name="Focus Score (Vision AI)", mode="lines+markers",
            line=dict(color="#00C2A8", width=3),
            marker=dict(size=5, color="#F4A261"),
            yaxis="y2",
        ))
        fig.update_layout(
            height=420,
            margin=dict(l=10, r=10, t=30, b=10),
            plot_bgcolor="white",
            paper_bgcolor="white",
            legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
            yaxis=dict(title="Sleep (hrs)", range=[0, 12], gridcolor="rgba(27,35,64,0.06)"),
            yaxis2=dict(title="Focus Score", overlaying="y", side="right", range=[0, 100], showgrid=False),
            xaxis=dict(gridcolor="rgba(27,35,64,0.04)"),
            font=dict(family="Inter", color="#1B2340"),
        )
        st.plotly_chart(fig, use_container_width=True)
        st.markdown('</div>', unsafe_allow_html=True)

    with fcol:
        tomorrow_focus = int(np.clip(data30["focus_score"].iloc[-5:].mean() + random.uniform(-3, 5), 0, 100))
        confidence = random.randint(82, 94)
        st.markdown(f"""
        <div class="forecast-box">
            <div style="font-size:12.5px; letter-spacing:1.5px; text-transform:uppercase; color:#8FA0D6; font-weight:700;">
                AI Predictive Forecast
            </div>
            <div style="font-family:'Space Grotesk',sans-serif; font-size:46px; font-weight:800; color:#00C2A8; margin-top:8px;">
                {tomorrow_focus}
            </div>
            <div style="font-size:13.5px; color:#C6D0F0; margin-top:2px;">Predicted Focus Score — Tomorrow</div>
            <hr style="border-color:rgba(255,255,255,0.12); margin:16px 0;">
            <div style="font-size:13px; color:#AEB8E0; line-height:1.6;">
                Model confidence: <b style="color:white;">{confidence}%</b><br>
                Key driver: <b style="color:white;">Sleep duration (last 3 nights)</b><br>
                Recommendation: <b style="color:#F4A261;">Target lights-out by 9:30 PM</b>
            </div>
        </div>
        """, unsafe_allow_html=True)

        st.markdown('<div class="cx-card" style="margin-top:18px;">', unsafe_allow_html=True)
        st.markdown('<div class="cx-section-title" style="font-size:16px;">Weekly Behavioral Notes</div>', unsafe_allow_html=True)
        st.markdown("""
        <div style="font-size:13.5px; color:#4A5578; line-height:1.7;">
        • Task-switching latency down <b style="color:#0DA37F;">12%</b><br>
        • 3 Dopamine Menu resets logged Tuesday<br>
        • Homework session completion at <b style="color:#0DA37F;">91%</b>
        </div>
        """, unsafe_allow_html=True)
        st.markdown('</div>', unsafe_allow_html=True)


# ============================================================================
# PORTAL 3 — CLINICAL PORTAL (Dr. Tarek) — STRICT DARK MODE
# ============================================================================
def render_clinical_portal():
    st.markdown("""
    <style>
    .stApp { background: #10172A !important; }
    section[data-testid="stSidebar"] + div .cx-section-title,
    .clin-title { color: #F5F7FB !important; }
    .clin-card {
        background: #171F38;
        border-radius: 14px;
        padding: 22px 24px;
        border: 1px solid rgba(0,194,168,0.15);
        box-shadow: 0 8px 24px rgba(0,0,0,0.35);
        margin-bottom: 18px;
    }
    .clin-card * { color: #DDE3F5; }
    .clin-label { color:#8FA0D6 !important; font-size:12px; text-transform:uppercase; letter-spacing:1px; font-weight:700;}
    .prob-gauge {
        background: linear-gradient(135deg, #1B2340, #26325C);
        border-radius: 14px; padding: 22px; text-align:center; margin-top:14px;
        border: 1px solid rgba(255,107,107,0.35);
    }
    .prob-value { font-family:'Space Grotesk',sans-serif; font-size:44px; font-weight:800; color:#FF6B6B; }
    .heatmap-box {
        background: #0A0F1E; border-radius: 12px; height: 220px;
        display:flex; align-items:center; justify-content:center;
        color:#3E4A78; font-size:13px; margin-top:12px;
        border: 1px dashed rgba(0,194,168,0.3);
        background-image: radial-gradient(circle at 40% 35%, rgba(255,107,107,0.35), transparent 45%),
                           radial-gradient(circle at 60% 55%, rgba(244,162,97,0.25), transparent 40%);
    }
    .score-row { display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.06); }
    .score-row:last-child { border-bottom:none; }
    .verdict-box {
        background: rgba(0,194,168,0.1); border:1px solid #00C2A8; border-radius:12px;
        padding:16px; margin-top:16px; text-align:center;
    }
    .verdict-title { color:#00C2A8 !important; font-weight:800; font-size:16px; }
    </style>
    """, unsafe_allow_html=True)

    st.markdown('<div class="cx-section-title clin-title">🏥 Clinical Review — Dr. Sarah Tarek, MD</div>', unsafe_allow_html=True)
    st.markdown('<div class="cx-section-sub" style="color:#8FA0D6;">Patient: Ethan Whitfield · MRN #88213-EW · DOB 03/14/2013</div>', unsafe_allow_html=True)

    col1, col2 = st.columns(2)

    # -------------------- COLUMN 1: Structural MRI AI Analyzer --------------------
    with col1:
        st.markdown('<div class="clin-card">', unsafe_allow_html=True)
        st.markdown('<div class="clin-label">Neuroimaging Module</div>', unsafe_allow_html=True)
        st.markdown('<div style="font-size:19px; font-weight:700; margin-top:2px;">Structural MRI AI Analyzer</div>', unsafe_allow_html=True)

        uploaded = st.file_uploader("Upload DICOM Series (.dcm)", type=["dcm"], key="dicom_upload")
        gradcam = st.toggle("Enable Grad-CAM XAI Heatmap", value=True)

        st.markdown(f"""
        <div class="heatmap-box">
            {"[ Grad-CAM Overlay — Prefrontal Cortex Activation Map ]" if gradcam else "[ Raw T1-weighted Axial Slice — Prefrontal Region ]"}
        </div>
        """, unsafe_allow_html=True)

        st.markdown("""
        <div class="prob-gauge">
            <div class="clin-label">ADHD Probability — CNN Classifier (3D-ResNet)</div>
            <div class="prob-value">85.4%</div>
            <div style="font-size:13px; color:#AEB8E0;">Based on reduced prefrontal cortex gray matter volume</div>
        </div>
        """, unsafe_allow_html=True)

        st.markdown("""
        <div style="margin-top:14px; font-size:13px; color:#8FA0D6; line-height:1.7;">
            Prefrontal Cortex Volume: <b style="color:#FF6B6B;">8.2% below age-norm</b><br>
            Caudate Nucleus Asymmetry: <b style="color:#F4A261;">Moderate</b><br>
            Model: 3D-ResNet50 · Trained on ENIGMA-ADHD cohort (n=3,242)
        </div>
        """, unsafe_allow_html=True)
        st.markdown('</div>', unsafe_allow_html=True)

    # -------------------- COLUMN 2: Multimodal Tabular AI Engine --------------------
    with col2:
        st.markdown('<div class="clin-card">', unsafe_allow_html=True)
        st.markdown('<div class="clin-label">Behavioral Module</div>', unsafe_allow_html=True)
        st.markdown('<div style="font-size:19px; font-weight:700; margin-top:2px;">Multimodal Tabular AI Engine</div>', unsafe_allow_html=True)

        sdq_scores = {"Emotional Symptoms": 6, "Conduct Problems": 4, "Hyperactivity": 9, "Peer Problems": 3, "Prosocial (inv.)": 7}
        apq_scores = {"Inconsistent Discipline": 62, "Poor Monitoring": 41, "Positive Parenting": 78, "Involvement": 70}

        st.markdown('<div style="font-size:13.5px; font-weight:700; margin-top:10px; color:#DDE3F5;">SDQ — Strengths & Difficulties</div>', unsafe_allow_html=True)
        for k, v in sdq_scores.items():
            st.markdown(f'<div class="score-row"><span style="color:#AEB8E0;">{k}</span><span style="font-weight:700;">{v}/10</span></div>', unsafe_allow_html=True)

        st.markdown('<div style="font-size:13.5px; font-weight:700; margin-top:14px; color:#DDE3F5;">APQ — Alabama Parenting Questionnaire</div>', unsafe_allow_html=True)
        for k, v in apq_scores.items():
            st.markdown(f'<div class="score-row"><span style="color:#AEB8E0;">{k}</span><span style="font-weight:700;">{v}th pct</span></div>', unsafe_allow_html=True)

        fig2 = go.Figure(go.Bar(
            x=list(sdq_scores.values()),
            y=list(sdq_scores.keys()),
            orientation="h",
            marker_color="#00C2A8",
        ))
        fig2.update_layout(
            height=210, margin=dict(l=10, r=10, t=10, b=10),
            paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
            font=dict(color="#DDE3F5", family="Inter"),
            xaxis=dict(range=[0, 10], gridcolor="rgba(255,255,255,0.06)"),
        )
        st.plotly_chart(fig2, use_container_width=True)

        st.markdown("""
        <div class="verdict-box">
            <div class="verdict-title">✅ Combined Subtype ADHD Confirmed</div>
            <div style="font-size:13px; color:#AEB8E0; margin-top:4px;">
                XGBoost Classifier · Confidence 91.2% · Features: SDQ + APQ + Vision-AI + MRI
            </div>
        </div>
        """, unsafe_allow_html=True)
        st.markdown('</div>', unsafe_allow_html=True)

    st.markdown('<hr class="cx-hr" style="border-color:rgba(255,255,255,0.08);">', unsafe_allow_html=True)
    pcol1, pcol2, pcol3 = st.columns([1, 1, 2])
    with pcol1:
        st.button("📄 Export Clinical PDF Report", use_container_width=True)
    with pcol2:
        st.button("✍️ Add Clinician Note", use_container_width=True)


# ============================================================================
# ROUTER
# ============================================================================
if portal == "🎮 Patient Portal":
    render_patient_portal()
elif portal == "📊 Parent Command Center":
    render_parent_portal()
else:
    render_clinical_portal()
