"""Unit tests for app/core/intervention_policy.py (deterministic clock)."""
import pytest

from app.core.intervention_policy import FocusState, InterventionPolicy, PolicyConfig

CFG = PolicyConfig(ema_alpha=1.0, min_samples=1, sustain_seconds=30, cooldown_seconds=300)


def run(policy, values, start=0.0, step=1.0):
    """Feed one value per `step` seconds; return all decisions."""
    return [policy.update(v, start + i * step) for i, v in enumerate(values)]


def nudges(decisions):
    return [d.nudge for d in decisions if d.nudge is not None]


def test_warming_up_until_min_samples():
    policy = InterventionPolicy(PolicyConfig(min_samples=5))
    states = [d.state for d in run(policy, [0.9] * 5)]
    assert states[:4] == [FocusState.WARMING_UP] * 4
    assert states[4] == FocusState.FOCUSED


def test_no_nudge_while_focused():
    assert nudges(run(InterventionPolicy(CFG), [0.9] * 600)) == []


def test_short_drift_does_not_nudge():
    policy = InterventionPolicy(CFG)
    decisions = run(policy, [0.9] * 10 + [0.1] * 20 + [0.9] * 10)
    assert nudges(decisions) == []


def test_sustained_drift_nudges_exactly_once():
    policy = InterventionPolicy(CFG)
    decisions = run(policy, [0.9] * 10 + [0.1] * 200)
    fired = nudges(decisions)
    assert len(fired) == 1
    assert fired[0].drift_seconds >= 30


def test_hysteresis_prevents_flicker_between_thresholds():
    """Values between low (0.5) and high (0.6) must not flip the state back."""
    policy = InterventionPolicy(CFG)
    run(policy, [0.9] * 5 + [0.2] * 5)
    assert policy.state == FocusState.DRIFTING
    run(policy, [0.55] * 20, start=100)
    assert policy.state == FocusState.DRIFTING
    run(policy, [0.7], start=200)
    assert policy.state == FocusState.FOCUSED


def test_cooldown_blocks_a_second_nudge_too_soon():
    policy = InterventionPolicy(CFG)
    # drift -> nudge at ~t=40, refocus, drift again shortly after
    seq = [0.9] * 10 + [0.1] * 40 + [0.9] * 10 + [0.1] * 60
    assert len(nudges(run(policy, seq))) == 1


def test_second_nudge_allowed_after_cooldown():
    policy = InterventionPolicy(CFG)
    seq = [0.9] * 10 + [0.1] * 40 + [0.9] * 300 + [0.1] * 60
    assert len(nudges(run(policy, seq))) == 2


def test_dismissal_doubles_cooldown_and_helpful_resets_it():
    policy = InterventionPolicy(CFG)
    policy.feedback(helpful=False)
    assert policy.current_cooldown == 600
    policy.feedback(helpful=False)
    assert policy.current_cooldown == 1200
    policy.feedback(helpful=False)
    assert policy.current_cooldown == 1800  # capped
    policy.feedback(helpful=True)
    assert policy.current_cooldown == 300


def test_ema_ignores_a_single_bad_window():
    policy = InterventionPolicy(PolicyConfig(ema_alpha=0.3, min_samples=1))
    run(policy, [0.9] * 20)
    decision = policy.update(0.0, 21)
    assert decision.state == FocusState.FOCUSED
    assert decision.smoothed_engagement > 0.5


def test_out_of_range_inputs_are_clamped():
    policy = InterventionPolicy(CFG)
    assert policy.update(7.0, 0).smoothed_engagement == 1.0
    assert policy.update(-3.0, 1).smoothed_engagement == 0.0


def test_invalid_config_is_rejected():
    with pytest.raises(ValueError):
        PolicyConfig(low_threshold=0.6, high_threshold=0.5)
    with pytest.raises(ValueError):
        PolicyConfig(ema_alpha=0)
