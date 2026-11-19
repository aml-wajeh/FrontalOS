"""
metrics.py

Evaluation metrics for DAiSEE's 4-level ordinal labels (0, 1, 2, 3).

The model is a regression head, so its raw outputs are continuous. We report:
    - MSE / MAE on the raw outputs (regression view; MSE is comparable to the
      validation MSE logged during training)
    - accuracy, macro-F1 and quadratic weighted kappa (QWK) after rounding the
      output to the nearest level and clipping to [0, 3] (ordinal view)

Pure NumPy, no scikit-learn dependency, so it is easy to unit-test.
"""

from __future__ import annotations

import numpy as np

NUM_LEVELS = 4  # DAiSEE levels: 0 very low, 1 low, 2 high, 3 very high


def to_levels(values: np.ndarray) -> np.ndarray:
    """Round continuous predictions to the nearest valid DAiSEE level."""
    return np.clip(np.rint(values), 0, NUM_LEVELS - 1).astype(int)


def confusion_matrix(y_true: np.ndarray, y_pred: np.ndarray, k: int = NUM_LEVELS) -> np.ndarray:
    cm = np.zeros((k, k), dtype=np.int64)
    for t, p in zip(y_true.astype(int), y_pred.astype(int)):
        cm[t, p] += 1
    return cm


def macro_f1(y_true: np.ndarray, y_pred: np.ndarray, k: int = NUM_LEVELS) -> float:
    """Macro-averaged F1 over the classes that appear in y_true or y_pred."""
    cm = confusion_matrix(y_true, y_pred, k)
    f1s = []
    for c in range(k):
        tp = cm[c, c]
        fp = cm[:, c].sum() - tp
        fn = cm[c, :].sum() - tp
        if tp + fp + fn == 0:
            continue  # class absent from both: skip rather than count as 0 or 1
        denom = 2 * tp + fp + fn
        f1s.append(0.0 if denom == 0 else 2 * tp / denom)
    return float(np.mean(f1s)) if f1s else 0.0


def quadratic_weighted_kappa(y_true: np.ndarray, y_pred: np.ndarray, k: int = NUM_LEVELS) -> float:
    """
    Cohen's kappa with quadratic weights. 1 = perfect agreement, 0 = chance
    level. A constant predictor always scores 0.
    """
    observed = confusion_matrix(y_true, y_pred, k).astype(float)
    n = observed.sum()
    if n == 0:
        return 0.0
    weights = np.array([[(i - j) ** 2 for j in range(k)] for i in range(k)], dtype=float)
    weights /= (k - 1) ** 2
    expected = np.outer(observed.sum(axis=1), observed.sum(axis=0)) / n
    denom = (weights * expected).sum()
    if denom == 0:
        return 0.0
    return float(1.0 - (weights * observed).sum() / denom)


def label_metrics(y_true: np.ndarray, y_pred_raw: np.ndarray) -> dict[str, float]:
    """All metrics for one label. y_true are ints 0..3, y_pred_raw are floats."""
    y_true = np.asarray(y_true, dtype=float)
    y_pred_raw = np.asarray(y_pred_raw, dtype=float)
    levels = to_levels(y_pred_raw)
    truth = y_true.astype(int)
    return {
        "mse": float(np.mean((y_pred_raw - y_true) ** 2)),
        "mae": float(np.mean(np.abs(y_pred_raw - y_true))),
        "accuracy": float(np.mean(levels == truth)),
        "macro_f1": macro_f1(truth, levels),
        "qwk": quadratic_weighted_kappa(truth, levels),
    }


def bootstrap_ci(
    y_true: np.ndarray,
    y_pred_raw: np.ndarray,
    metric: str,
    n_boot: int = 1000,
    seed: int = 0,
) -> tuple[float, float]:
    """95% percentile bootstrap confidence interval for one metric."""
    rng = np.random.default_rng(seed)
    n = len(y_true)
    stats = []
    for _ in range(n_boot):
        idx = rng.integers(0, n, n)
        stats.append(label_metrics(y_true[idx], y_pred_raw[idx])[metric])
    lo, hi = np.percentile(stats, [2.5, 97.5])
    return float(lo), float(hi)
