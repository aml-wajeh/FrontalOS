import math

from app.core.focus_score import compute_focus_score


def test_best_case_all_zero_negatives_max_engagement_is_10():
    # boredom=confusion=frustration=0 (best), engagement=1 (best) -> 10.0
    score = compute_focus_score(boredom=0.0, engagement=1.0, confusion=0.0, frustration=0.0)
    assert score == 10.0


def test_worst_case_all_max_negatives_zero_engagement_is_0():
    score = compute_focus_score(boredom=1.0, engagement=0.0, confusion=1.0, frustration=1.0)
    assert score == 0.0


def test_matches_documented_weighted_formula():
    b, e, c, f = 0.2, 0.6, 0.1, 0.3
    expected = 10.0 * (0.50 * e + 0.25 * (1 - b) + 0.15 * (1 - c) + 0.10 * (1 - f))
    assert compute_focus_score(b, e, c, f) == expected


def test_out_of_range_inputs_are_clamped_not_left_out_of_bounds():
    # Regression head has no guaranteed [0,1] range -- must not blow past [0,10].
    score_high = compute_focus_score(boredom=-5.0, engagement=50.0, confusion=-2.0, frustration=-1.0)
    score_low = compute_focus_score(boredom=99.0, engagement=-99.0, confusion=99.0, frustration=99.0)
    assert 0.0 <= score_high <= 10.0
    assert 0.0 <= score_low <= 10.0
    assert score_high == 10.0
    assert score_low == 0.0


def test_nan_input_is_treated_as_zero_not_propagated():
    score = compute_focus_score(boredom=float("nan"), engagement=0.5, confusion=0.0, frustration=0.0)
    # NaN boredom clamps to 0.0 -> contributes its full (1 - 0) weight, and
    # the result must be a real, in-range number (no NaN leaking to the client).
    assert not math.isnan(score)
    assert 0.0 <= score <= 10.0
