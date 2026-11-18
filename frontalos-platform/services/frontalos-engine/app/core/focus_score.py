"""
core/focus_score.py

Derives the single "Focus Score / 10" metric shown in the Patient Portal's
Live AI Observer card from the model's four raw regression outputs
(Boredom, Engagement, Confusion, Frustration).

The raw model outputs are regression values that *should* sit roughly in
[0, 1] (they were trained against DAiSEE's normalized affect labels), but
because this is a regression head (not a softmax), nothing guarantees the
output stays in range for out-of-distribution frames -- so every value is
clamped defensively before it's used.

Formula
-------
focus_score = 10 * (
      0.50 * engagement           # primary driver: attentiveness
    + 0.25 * (1 - boredom)        # boredom detracts from focus
    + 0.15 * (1 - confusion)      # confusion detracts, but less than boredom
    + 0.10 * (1 - frustration)    # frustration detracts the least
)

Weights sum to 1.0, so with all four raw values clamped to [0, 1] the
result before the final clip already lands in [0, 10]; the outer clip is
kept purely as a defensive guard.
"""

from __future__ import annotations

ENGAGEMENT_WEIGHT = 0.50
BOREDOM_WEIGHT = 0.25
CONFUSION_WEIGHT = 0.15
FRUSTRATION_WEIGHT = 0.10


def _clamp01(value: float) -> float:
    if value != value:  # NaN check without importing math
        return 0.0
    return max(0.0, min(1.0, float(value)))


def compute_focus_score(boredom: float, engagement: float, confusion: float, frustration: float) -> float:
    """Returns a 0-10 Focus Score derived from the four raw model outputs."""
    b = _clamp01(boredom)
    e = _clamp01(engagement)
    c = _clamp01(confusion)
    f = _clamp01(frustration)

    raw = 10.0 * (
        ENGAGEMENT_WEIGHT * e
        + BOREDOM_WEIGHT * (1.0 - b)
        + CONFUSION_WEIGHT * (1.0 - c)
        + FRUSTRATION_WEIGHT * (1.0 - f)
    )
    return max(0.0, min(10.0, raw))
