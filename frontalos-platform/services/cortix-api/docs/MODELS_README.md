# CORTIX — Where Real Model Weights Go

BUG FIX (staff audit follow-up, revised): the previous version of this file
claimed the checked-in tabular model "loads successfully" and runs live
"out of the box, no setup needed." **That was verified false during a QA
pass — it does not currently load, and installing xgboost does not fix it.**

`services/cortix-api/models/adhd_model_pca_no_outliers_tuned.pkl` (~51MB)
*is* checked into this repo, but the file was pickled against a custom
`V3Ensemble` wrapper class that isn't defined anywhere in this codebase —
it must have lived in the original training workspace referenced in
`reference/CORTIX/docs/CORTIX_Platform_Architecture_Report.md` as
`model_ADHD.rar`, which was never checked in. Loading it raises
`AttributeError: Can't get attribute 'V3Ensemble' ...`, every time,
regardless of which packages are installed.

The service layer (`core/ai/tabular_service.py`) already handles this
safely and correctly: it tries to load the file at startup, and if that
fails for *any* reason it falls back to demo mode rather than crashing —
so `POST /api/v1/ai/tabular` runs in `"inference_mode": "demo"` on a fresh
checkout today, not `"live"`. The specific reason is no longer hidden:
`GET /health` and the admin portal's System Health panel both now expose
an `ai_model_load_errors.tabular` field with the exact exception message,
so this is diagnosable instead of looking like the file is simply absent.

**To actually make Model 1 live**, one of the following needs to happen:
1. Recover the `V3Ensemble` class definition from the original
   `model_ADHD.rar` workspace and add it to this codebase (e.g. alongside
   `core/ai/tabular_service.py`) so pickle can resolve it at load time; or
2. Re-export the trained model as a plain `xgboost.XGBClassifier` /
   `Booster` (or another dependency-free format) that doesn't require a
   custom wrapper class to unpickle.

Only the two **imaging** weight files (`best_model.h5` and
`best_model_smote_female_adhd.h5`) are genuinely absent — `POST
/api/v1/ai/mri` runs in `"inference_mode": "demo"` until those are placed
at the paths below. There is no partial or silent "live" state: each model
independently checks whether its file exists *and loads successfully* at
startup, and only switches to `"live"` if both are true.

## 1. Drop-in paths (default, no config needed)

Place the three trained files here and restart the API:

```
services/cortix-api/models/adhd_model_pca_no_outliers_tuned.pkl   # Model 1 — XGBoost tabular/connectome
services/cortix-api/models/best_model.h5                          # Model 2 — Keras CNN, general MRI
services/cortix-api/models/best_model_smote_female_adhd.h5        # Model 2b — Keras CNN, female-specific variant
```

These three filenames match the ones referenced throughout
`services/cortix-api/reference/CORTIX/docs/CORTIX_Platform_Architecture_Report.md`.
`best_model_smote_female_adhd.h5` loads into `CORTIX_MRI_MODEL_PATH_FEMALE`
and **is** routed to: `core/ai/imaging_service.py` loads both weight files
independently at startup, and `POST /api/v1/ai/mri` passes the patient's
recorded `gender` through automatically — if it's `"female"` *and* the
female weight file loaded successfully, that model is used; every other
case (male, unset, or the female file simply not present) falls back to
the general model exactly as before. The response's `model_variant` field
(`"general"` or `"female"`) says which one actually ran.

## 2. Or point elsewhere via environment variables

Set these in `.env` (see `.env.example` at the platform root) to use a
different location — useful for a shared model volume in a container
deployment:

```
CORTIX_TABULAR_MODEL_PATH=/path/to/adhd_model_pca_no_outliers_tuned.pkl
CORTIX_MRI_MODEL_PATH=/path/to/best_model.h5
CORTIX_MRI_MODEL_PATH_FEMALE=/path/to/best_model_smote_female_adhd.h5
```

If unset, they default to the `services/cortix-api/models/` paths above
(see `core/config.py`).

## 3. How to verify which mode is active

`GET /health` reports the live mode of each loaded model without needing to
run a prediction, plus *why* if a model that should be live isn't:

```json
{
  "ai_models": { "tabular": "demo", "imaging": "demo" },
  "ai_model_load_errors": {
    "tabular": "Can't get attribute 'V3Ensemble' on <module '__main__' ...>",
    "imaging": null
  }
}
```

(`ai_model_load_errors.<model>` is `null` when that model's path is simply
unset/missing, or when it's `"live"` — it's only populated when a file is
present but failed to load, which is exactly today's tabular case; see
§1's note above for why. A fresh checkout reports `"tabular": "demo"` and
`"imaging": "demo"` until that's resolved.)

Every prediction response also carries its own `inference_mode` field, so
the frontend can badge individual results even if, say, the tabular model
is live but the imaging model is still demo — or vice versa, once either
one actually is.

## 4. Training data (only needed if retraining)

Not included in this repo (~15GB). If retraining is ever needed, the
expected layout — matching the feature spec in
`services/cortix-api/reference/CORTIX/docs/CORTIX_Platform_Architecture_Report.md` —
is:

```
datasets/WiDS_HBN/     # WiDS Datathon 2025 / Healthy Brain Network — tabular/connectome source for Model 1
datasets/ADHD-200/     # ADHD-200 consortium — MRI/NIfTI source for Model 2
```

Both directories are `.gitignore`d at the platform root (`datasets/`).
Nothing in the API code assumes these exist — they're only relevant to a
separate offline retraining pipeline, not to serving predictions.

## 5. What "demo" mode actually does (so it's never mistaken for real output)

- **Tabular (Model 1):** `core/ai/tabular_service.py::_demo_predict` derives
  a probability from a SHA-256 hash of the input vector blended with a
  simple statistic of the features. It is deterministic per input, not
  random, but it is **not a trained classifier** and carries no clinical
  meaning.
- **Imaging (Model 2):** `core/ai/imaging_service.py::_demo_predict` runs
  the real preprocessing pipeline (decode → extract slice → normalize →
  resize) on whatever file was actually uploaded, then derives a
  probability and a radial "Grad-CAM-style" heatmap from that real pixel
  data plus a hash of the file bytes. The overlay is **not real Grad-CAM**
  (no gradients are computed — there's no live model to take them from).

Both are labeled `"inference_mode": "demo"` in every response, plus a
`"demo_note"` string, specifically so a demo result can never be mistaken
for a live one downstream.
