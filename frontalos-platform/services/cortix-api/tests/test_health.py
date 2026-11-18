"""
Tests for GET /health (main.py) — previously untested.

Also locks in the specific, verified-during-QA state of the checked-in
tabular model: present on disk but currently unloadable (see
core/ai/tabular_service.py's docstring and docs/MODELS_README.md for why),
so `ai_model_load_errors.tabular` should always be populated with the
`V3Ensemble` AttributeError rather than being None. If someone fixes the
underlying V3Ensemble issue and the model starts loading live, this test
will start failing — which is the point: it's a tripwire pointing back at
docs/MODELS_README.md's "how to actually make Model 1 live" section
rather than a silent, unnoticed change in behavior.
"""


def test_health_reports_ai_model_modes_and_load_errors(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    body = resp.json()

    assert body["status"] == "healthy"
    assert set(body["ai_models"]) == {"tabular", "imaging"}
    assert set(body["ai_model_load_errors"]) == {"tabular", "imaging"}

    # Imaging: no .h5 files ship in this repo, so it's cleanly "demo" with
    # no load_error (the path is simply unset/missing, not a failed load).
    assert body["ai_models"]["imaging"] == "demo"
    assert body["ai_model_load_errors"]["imaging"] is None

    # Tabular: the .pkl DOES ship but doesn't currently load — demo mode,
    # with the specific reason surfaced rather than hidden.
    assert body["ai_models"]["tabular"] == "demo"
    assert body["ai_model_load_errors"]["tabular"] is not None
    assert "V3Ensemble" in body["ai_model_load_errors"]["tabular"]
