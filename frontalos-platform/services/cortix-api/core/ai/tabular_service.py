"""
Model 1 — tabular/connectome ADHD classifier.

Live mode: loads adhd_model_pca_no_outliers_tuned.pkl from
core.config.settings.CORTIX_TABULAR_MODEL_PATH and runs real inference —
but only if that file actually deserializes into a usable model object.

Demo mode: either no file is present at that path, OR a file is present
but failed to load (see load_error below for why). As of this writing,
the checked-in adhd_model_pca_no_outliers_tuned.pkl is present but is
NOT currently loadable here: it was pickled against a custom `V3Ensemble`
wrapper class that isn't defined anywhere in this repo (it must live in
the original training workspace referenced in
reference/CORTIX/docs/CORTIX_Platform_Architecture_Report.md as
`model_ADHD.rar`, which was never checked in). Loading it raises
`AttributeError: Can't get attribute 'V3Ensemble' ...` regardless of
which packages are installed — this is not an xgboost version issue.
_try_load() catches that (and any other load failure) and falls back to
demo mode rather than crashing, and stores the reason on load_error so
GET /health and the admin System Health panel can show *why*, instead of
"demo" looking like the file is simply missing. See docs/MODELS_README.md
for the full story and what would need to happen to make this live
(the V3Ensemble class definition would need to be added back to this
repo, or the model retrained/re-exported as a plain XGBoost object).

Either way, every response is tagged `inference_mode` so the frontend
(and this docstring) never has to pretend demo output is a real
classifier result — see _demo_predict below.

xgboost is imported implicitly via pickle only inside the live branch's
load attempt, so this module — and the whole tabular endpoint — works
even in environments where xgboost isn't installed, as long as no real
model file is present (or, as above, present but unloadable).
"""
import hashlib
import os
import pickle
from typing import Optional

import numpy as np

from core.config import settings

FEATURE_COUNT = settings.TABULAR_FEATURE_COUNT


class TabularModelError(Exception):
    pass


class TabularService:
    def __init__(self, model_path: Optional[str] = None):
        self.model_path = model_path or settings.CORTIX_TABULAR_MODEL_PATH
        self._model = None
        self._mode = "demo"
        self._load_error: Optional[str] = None
        self._try_load()

    def _try_load(self) -> None:
        if not self.model_path or not os.path.exists(self.model_path):
            self._mode = "demo"
            return
        try:
            with open(self.model_path, "rb") as f:
                self._model = pickle.load(f)
            self._mode = "live"
        except Exception as e:  # noqa: BLE001 — any load failure -> demo, never crash the app
            self._model = None
            self._mode = "demo"
            self._load_error = str(e)

    @property
    def mode(self) -> str:
        return self._mode

    @property
    def load_error(self) -> Optional[str]:
        """Why this stayed in demo mode despite a model_path being configured —
        None if the path is simply unset/missing, or if mode is "live"."""
        return self._load_error

    def validate_shape(self, features: list[float]) -> np.ndarray:
        arr = np.asarray(features, dtype=np.float64).reshape(1, -1)
        if arr.shape[1] != FEATURE_COUNT:
            raise TabularModelError(
                f"Expected exactly {FEATURE_COUNT} PCA-transformed features "
                f"(functional connectome + demographic/behavioral, per the "
                f"WiDS Datathon 2025 / HBN spec), got {arr.shape[1]}."
            )
        return arr

    def predict(self, features: list[float]) -> dict:
        arr = self.validate_shape(features)

        if self._mode == "live" and self._model is not None:
            preds = self._model.predict(arr)
            probs = self._model.predict_proba(arr)
            prob_positive = float(probs[0][1])
            prediction = int(preds[0])
            confidence = float(max(probs[0]))
            return {
                "inference_mode": "live",
                "prediction": prediction,
                "probability": prob_positive,
                "probabilities": probs[0].tolist(),
                "confidence": confidence,
            }

        return self._demo_predict(arr)

    def _demo_predict(self, arr: np.ndarray) -> dict:
        """Deterministic-per-input heuristic, NOT a trained model.

        We derive a stable pseudo-probability from a hash of the rounded
        input vector (so the same input always returns the same demo
        result, instead of pure randomness that could be mistaken for
        instability in a real model) blended with a simple summary
        statistic of the feature vector. This is intentionally documented
        here rather than dressed up to look like a trained classifier.
        """
        rounded = np.round(arr, 4)
        digest = hashlib.sha256(rounded.tobytes()).hexdigest()
        hash_component = (int(digest[:8], 16) % 10000) / 10000.0  # [0, 1)

        # Fold in the actual feature values so different real inputs still
        # move the score, rather than the score being pure hash noise.
        finite = arr[np.isfinite(arr)]
        signal_component = 0.5
        if finite.size:
            signal_component = float(np.clip(0.5 + np.tanh(np.mean(finite)) * 0.25, 0.0, 1.0))

        prob_positive = float(np.clip(0.5 * hash_component + 0.5 * signal_component, 0.01, 0.99))
        prediction = int(prob_positive > 0.5)
        probabilities = [1 - prob_positive, prob_positive]

        return {
            "inference_mode": "demo",
            "prediction": prediction,
            "probability": prob_positive,
            "probabilities": probabilities,
            "confidence": float(max(probabilities)),
            "demo_note": (
                "No trained model file found at CORTIX_TABULAR_MODEL_PATH — "
                "this score is a deterministic placeholder heuristic, not a "
                "real classifier output. See docs/MODELS_README.md."
            ),
        }


tabular_service = TabularService()
