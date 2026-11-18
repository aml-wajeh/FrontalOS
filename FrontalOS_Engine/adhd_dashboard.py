"""
adhd_dashboard.py

Macro-level ADHD Market & Awareness Dashboard - Egypt (Synthetic Data)

Run with: streamlit run adhd_dashboard.py
"""

import numpy as np
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st

# --------------------------------------------------------------------------- #
# Page configuration
# --------------------------------------------------------------------------- #
st.set_page_config(
    page_title="ADHD Market & Awareness Dashboard - Egypt",
    page_icon="🧠",
    layout="wide",
)

REGION_COLORS = {"Urban": "#2E86AB", "Rural": "#F18F01"}
AWARENESS_COLORS = {"Low": "#E63946", "Medium": "#F4A261", "High": "#2A9D8F"}

AGE_GROUPS = ["4-12 (Children)", "13-18 (Adolescents)", "19-40 (Adults)", "41+ (Older Adults)"]
GOVERNORATES = [
    "Cairo", "Giza", "Alexandria", "Qalyubia", "Sharqia",
    "Dakahlia", "Beheira", "Minya", "Assiut", "Sohag",
]


# --------------------------------------------------------------------------- #
# Synthetic data generation (cached so filters don't regenerate the dataset)
# --------------------------------------------------------------------------- #
@st.cache_data(show_spinner="Generating synthetic population dataset...")
def generate_synthetic_data(n: int = 10_000, seed: int = 42) -> pd.DataFrame:
    rng = np.random.default_rng(seed)

    # --- Demographics -------------------------------------------------- #
    age_group = rng.choice(AGE_GROUPS, size=n, p=[0.20, 0.15, 0.45, 0.20])
    region = rng.choice(["Urban", "Rural"], size=n, p=[0.42, 0.58])
    gender = rng.choice(["Male", "Female"], size=n, p=[0.505, 0.495])
    governorate = rng.choice(GOVERNORATES, size=n)

    # --- Hidden ground-truth ADHD prevalence (age-dependent) ----------- #
    # Weighted average across age-group proportions lands within the
    # clinically-cited 5-8% overall prevalence range.
    prevalence_by_age = {
        "4-12 (Children)": 0.09,
        "13-18 (Adolescents)": 0.07,
        "19-40 (Adults)": 0.04,
        "41+ (Older Adults)": 0.025,
    }
    base_prevalence = np.array([prevalence_by_age[a] for a in age_group])

    # Males present higher rates in childhood/adolescence, consistent with
    # widely reported clinical patterns.
    male_youth_mask = (gender == "Male") & np.isin(age_group, AGE_GROUPS[:2])
    female_youth_mask = (gender == "Female") & np.isin(age_group, AGE_GROUPS[:2])
    gender_multiplier = np.ones(n)
    gender_multiplier[male_youth_mask] = 1.30
    gender_multiplier[female_youth_mask] = 0.75

    prevalence = np.clip(base_prevalence * gender_multiplier, 0, 1)
    has_adhd = rng.binomial(1, prevalence).astype(bool)

    # --- Awareness level (skewed toward Urban) -------------------------- #
    awareness_level = np.empty(n, dtype=object)
    urban_mask = region == "Urban"
    awareness_level[urban_mask] = rng.choice(
        ["Low", "Medium", "High"], size=urban_mask.sum(), p=[0.20, 0.45, 0.35]
    )
    awareness_level[~urban_mask] = rng.choice(
        ["Low", "Medium", "High"], size=(~urban_mask).sum(), p=[0.50, 0.35, 0.15]
    )

    # --- Medical consultation probability ------------------------------- #
    base_consult_prob = np.select(
        [awareness_level == "Low", awareness_level == "Medium", awareness_level == "High"],
        [0.15, 0.45, 0.75],
        default=0.15,
    )
    urban_boost = np.where(region == "Urban", 0.10, 0.0)
    consult_prob_adhd = np.clip(base_consult_prob + urban_boost, 0, 0.95)
    consult_prob_no_adhd = 0.01  # rare unrelated/general consultations
    consult_prob = np.where(has_adhd, consult_prob_adhd, consult_prob_no_adhd)
    consulted_doctor = rng.binomial(1, consult_prob).astype(bool)

    # --- Formal diagnosis (requires ADHD + consultation + confirmation) - #
    diagnosis_success_prob = 0.85
    diagnosed = has_adhd & consulted_doctor & (rng.random(n) < diagnosis_success_prob)
    hidden_adhd = has_adhd & ~diagnosed

    df = pd.DataFrame(
        {
            "Age_Group": age_group,
            "Region": region,
            "Gender": gender,
            "Governorate": governorate,
            "Awareness_Level": pd.Categorical(
                awareness_level, categories=["Low", "Medium", "High"], ordered=True
            ),
            "Has_ADHD": has_adhd,
            "Consulted_Doctor": consulted_doctor,
            "Diagnosed": diagnosed,
            "Hidden_ADHD": hidden_adhd,
        }
    )
    return df


# --------------------------------------------------------------------------- #
# Data + sidebar filters
# --------------------------------------------------------------------------- #
df_full = generate_synthetic_data()

st.sidebar.header("🔎 Filters")
selected_regions = st.sidebar.multiselect("Region", options=["Urban", "Rural"], default=["Urban", "Rural"])
selected_ages = st.sidebar.multiselect("Age Group", options=AGE_GROUPS, default=AGE_GROUPS)
selected_genders = st.sidebar.multiselect("Gender", options=["Male", "Female"], default=["Male", "Female"])

df = df_full[
    df_full["Region"].isin(selected_regions)
    & df_full["Age_Group"].isin(selected_ages)
    & df_full["Gender"].isin(selected_genders)
]

if df.empty:
    st.warning("No records match the selected filters. Please broaden your selection.")
    st.stop()

# --------------------------------------------------------------------------- #
# Header + KPI row
# --------------------------------------------------------------------------- #
st.title("🧠 ADHD Market & Awareness Dashboard — Egypt")
st.caption(
    "Synthetic population model (n = 10,000) illustrating the gap between estimated ADHD "
    "prevalence and formal diagnosis, driven by regional awareness and consultation behavior."
)

total_pop = len(df)
total_adhd = int(df["Has_ADHD"].sum())
total_diagnosed = int(df["Diagnosed"].sum())
total_hidden = int(df["Hidden_ADHD"].sum())
prevalence_pct = (total_adhd / total_pop * 100) if total_pop else 0
capture_rate_pct = (total_diagnosed / total_adhd * 100) if total_adhd else 0

k1, k2, k3, k4 = st.columns(4)
k1.metric("Sample Population", f"{total_pop:,}")
k2.metric("Estimated ADHD Prevalence", f"{prevalence_pct:.1f}%", help="Share of the (filtered) sample with hidden ADHD")
k3.metric("Formally Diagnosed", f"{total_diagnosed:,}", f"{capture_rate_pct:.1f}% of true cases")
k4.metric("Hidden / Undiagnosed Cases", f"{total_hidden:,}", delta_color="inverse")

st.divider()

# --------------------------------------------------------------------------- #
# Chart 1 - Funnel: Prevalence vs. Actual Diagnosis (awareness gap)
# --------------------------------------------------------------------------- #
st.subheader("1. The Awareness Gap: Prevalence → Diagnosis Funnel")

stage_population = total_pop
stage_adhd = total_adhd
stage_aware = int(df[df["Has_ADHD"] & df["Awareness_Level"].isin(["Medium", "High"])].shape[0])
stage_consulted = int(df[df["Has_ADHD"] & df["Consulted_Doctor"]].shape[0])
stage_diagnosed = total_diagnosed

funnel_fig = go.Figure(
    go.Funnel(
        y=[
            "Total Population",
            "Estimated ADHD Cases",
            "Aware of Symptoms",
            "Sought Medical Consultation",
            "Formally Diagnosed",
        ],
        x=[stage_population, stage_adhd, stage_aware, stage_consulted, stage_diagnosed],
        textposition="inside",
        textinfo="value+percent initial",
        marker={"color": ["#264653", "#2A9D8F", "#E9C46A", "#F4A261", "#E63946"]},
        connector={"line": {"color": "royalblue", "dash": "dot", "width": 2}},
    )
)
funnel_fig.update_layout(height=480, margin=dict(t=30, b=20))
st.plotly_chart(funnel_fig, use_container_width=True)

st.divider()

# --------------------------------------------------------------------------- #
# Chart 2 - Diagnosis capture rate by Age Group & Region
# --------------------------------------------------------------------------- #
col_left, col_right = st.columns(2)

with col_left:
    st.subheader("2. Diagnosis Capture Rate by Age & Region")

    grp = (
        df.groupby(["Age_Group", "Region"], observed=True)
        .agg(ADHD_Cases=("Has_ADHD", "sum"), Diagnosed_Cases=("Diagnosed", "sum"))
        .reset_index()
    )
    grp["Diagnosis_Rate_%"] = np.where(
        grp["ADHD_Cases"] > 0, grp["Diagnosed_Cases"] / grp["ADHD_Cases"] * 100, 0
    )

    fig2 = px.bar(
        grp,
        x="Age_Group",
        y="Diagnosis_Rate_%",
        color="Region",
        barmode="group",
        color_discrete_map=REGION_COLORS,
        text_auto=".1f",
        labels={"Diagnosis_Rate_%": "% of True Cases Diagnosed", "Age_Group": "Age Group"},
        category_orders={"Age_Group": AGE_GROUPS},
    )
    fig2.update_layout(height=440, yaxis_ticksuffix="%", legend_title="Region")
    st.plotly_chart(fig2, use_container_width=True)

# --------------------------------------------------------------------------- #
# Chart 3 - Medical consultation rates (among ADHD-positive) by Age & Region
# --------------------------------------------------------------------------- #
with col_right:
    st.subheader("3. Medical Consultation Rate by Age & Region")

    adhd_df = df[df["Has_ADHD"]]
    if adhd_df.empty:
        st.info("No ADHD-positive records in the current filter selection.")
    else:
        cons = (
            adhd_df.groupby(["Age_Group", "Region"], observed=True)
            .agg(ADHD_Cases=("Has_ADHD", "sum"), Consulted=("Consulted_Doctor", "sum"))
            .reset_index()
        )
        cons["Consultation_Rate_%"] = np.where(
            cons["ADHD_Cases"] > 0, cons["Consulted"] / cons["ADHD_Cases"] * 100, 0
        )

        fig3 = px.bar(
            cons,
            x="Age_Group",
            y="Consultation_Rate_%",
            color="Region",
            barmode="group",
            color_discrete_map=REGION_COLORS,
            text_auto=".1f",
            labels={"Consultation_Rate_%": "% of ADHD Cases That Consulted a Doctor", "Age_Group": "Age Group"},
            category_orders={"Age_Group": AGE_GROUPS},
        )
        fig3.update_layout(height=440, yaxis_ticksuffix="%", legend_title="Region")
        st.plotly_chart(fig3, use_container_width=True)

st.divider()

# --------------------------------------------------------------------------- #
# Chart 4 - Awareness level composition (Region -> Awareness Level)
# --------------------------------------------------------------------------- #
st.subheader("4. Public Awareness Level Composition")

awareness_counts = (
    df.groupby(["Region", "Awareness_Level"], observed=True).size().reset_index(name="Count")
)

# 🛠️ الحل الهندسي: تحويل الأعمدة إلى نصوص عادية لتجنب صدام Categorical مع Plotly
awareness_counts["Region"] = awareness_counts["Region"].astype(str)
awareness_counts["Awareness_Level"] = awareness_counts["Awareness_Level"].astype(str)

fig4 = px.sunburst(
    awareness_counts,
    path=["Region", "Awareness_Level"],
    values="Count",
    color="Awareness_Level",
    color_discrete_map={**AWARENESS_COLORS, "(?)": "#CCCCCC"},
)
fig4.update_layout(height=500, margin=dict(t=20, b=20))
st.plotly_chart(fig4, use_container_width=True)

st.caption(
    "⚠️ All figures are derived from a synthetic dataset generated for demonstration purposes "
    "and do not represent verified census or clinical data for Egypt."
)
