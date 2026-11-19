"""Unit tests for metrics.py (pure NumPy)."""
import numpy as np
import pytest

from metrics import label_metrics, macro_f1, quadratic_weighted_kappa, to_levels


def test_to_levels_rounds_and_clips_to_valid_range():
    assert to_levels(np.array([-0.7, 0.4, 1.6, 2.5, 9.0])).tolist() == [0, 0, 2, 2, 3]


def test_perfect_predictions():
    y = np.array([0, 1, 2, 3, 2, 1])
    m = label_metrics(y, y.astype(float))
    assert m["mae"] == 0 and m["accuracy"] == 1
    assert m["macro_f1"] == pytest.approx(1.0)
    assert m["qwk"] == pytest.approx(1.0)


def test_constant_predictor_has_zero_kappa():
    """The key baseline property: predicting one level for everything scores QWK 0."""
    y = np.array([0, 1, 2, 3, 2, 2, 1, 0])
    assert quadratic_weighted_kappa(y, np.full_like(y, 2)) == pytest.approx(0.0)


def test_qwk_penalises_far_errors_more_than_near_errors():
    y = np.array([0, 1, 2, 3] * 5)
    near = np.clip(y + 1, 0, 3)
    far = 3 - y
    assert quadratic_weighted_kappa(y, near) > quadratic_weighted_kappa(y, far)


def test_macro_f1_ignores_classes_absent_from_both():
    y = np.array([0, 0, 1, 1])
    assert macro_f1(y, y) == pytest.approx(1.0)


def test_mse_matches_numpy():
    y = np.array([0, 1, 2, 3])
    p = np.array([0.5, 1.0, 1.5, 3.0])
    assert label_metrics(y, p)["mse"] == pytest.approx(np.mean((p - y) ** 2))
