"""
Tests for api/v1/ai.py — tabular and MRI prediction endpoints.

Both AI services are in "demo" mode in every environment that runs this
test file today, but for two different reasons:

- Imaging: no .h5 weight files are checked into services/cortix-api/models/
  at all, so core.ai.imaging_service has nothing to try loading.
- Tabular: a real ~51MB adhd_model_pca_no_outliers_tuned.pkl *is* checked
  in, but it fails to unpickle here — it depends on a custom `V3Ensemble`
  class that isn't defined anywhere in this repo (see the top of
  core/ai/tabular_service.py and docs/MODELS_README.md for the full story).
  core.ai.tabular_service catches that at startup and falls back to demo
  mode rather than crashing, same as the "file simply isn't there" case
  imaging is in — which is exactly why these tests don't need to
  distinguish the two: either way, the contract under test is unaffected.

These tests lock in the contract that matters most for the frontend:
every response is honestly tagged `inference_mode: "demo"` (never silently
pretending to be a real model), and a missing/malformed input is rejected
with 400/422 rather than crashing or fabricating a result.

Live-mode behavior (a model that actually loads) is NOT exercised here —
for imaging that would require shipping real trained weights into version
control, which this repo deliberately does not do; for tabular it would
additionally require the missing V3Ensemble class to exist. See
docs/MODELS_README.md for what would need to change on either front.
"""
import io

from PIL import Image

from core.ai.tabular_service import FEATURE_COUNT
from database.models import Patient


def _make_patient(db_session, **kwargs):
    patient = Patient(name=kwargs.pop("name", "AI Patient"), age=kwargs.pop("age", 10), gender=kwargs.pop("gender", "female"), **kwargs)
    db_session.add(patient)
    db_session.commit()
    db_session.refresh(patient)
    return patient


def _synthetic_png_bytes(size=(32, 32), fill=140) -> bytes:
    img = Image.new("L", size, color=fill)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


# --- Tabular ------------------------------------------------------------


def test_tabular_predict_is_tagged_demo_mode(client, db_session):
    patient = _make_patient(db_session)
    features = [0.1] * FEATURE_COUNT

    resp = client.post("/api/v1/ai/tabular", json={"patient_id": patient.id, "features": features})
    assert resp.status_code == 200
    body = resp.json()
    assert body["inference_mode"] == "demo"
    assert "demo_note" in body
    assert body["risk_level"] in ("High", "Low")
    assert 0.0 <= body["probability"] <= 1.0
    assert 0.0 <= body["confidence"] <= 1.0


def test_tabular_predict_same_input_is_deterministic(client, db_session):
    """The demo heuristic is documented as deterministic-per-input (hash of
    the rounded feature vector) — same input must give the same
    probability, not random noise that could be mistaken for model
    instability."""
    patient = _make_patient(db_session)
    features = [0.37] * FEATURE_COUNT

    first = client.post("/api/v1/ai/tabular", json={"patient_id": patient.id, "features": features}).json()
    second = client.post("/api/v1/ai/tabular", json={"patient_id": patient.id, "features": features}).json()
    assert first["probability"] == second["probability"]
    assert first["prediction"] == second["prediction"]


def test_tabular_predict_wrong_feature_count_is_rejected(client, db_session):
    patient = _make_patient(db_session)
    resp = client.post("/api/v1/ai/tabular", json={"patient_id": patient.id, "features": [0.1, 0.2, 0.3]})
    assert resp.status_code == 400


def test_tabular_predict_unknown_patient_404s(client):
    resp = client.post("/api/v1/ai/tabular", json={"patient_id": 999999, "features": [0.1] * FEATURE_COUNT})
    assert resp.status_code == 404


def test_tabular_predict_persists_prediction_row(client, db_session):
    patient = _make_patient(db_session)
    resp = client.post(
        "/api/v1/ai/tabular", json={"patient_id": patient.id, "features": [0.2] * FEATURE_COUNT}
    )
    prediction_id = resp.json()["prediction_id"]
    assert isinstance(prediction_id, int)

    from database.models import AIPrediction

    row = db_session.query(AIPrediction).filter(AIPrediction.id == prediction_id).first()
    assert row is not None
    assert row.model_type == "tabular"
    assert row.prediction_result["inference_mode"] == "demo"


def test_tabular_predict_notifies_guardian_and_doctor(client, db_session):
    """A new AIPrediction should create a Notification for whichever of
    guardian_id/doctor_id are set on the patient — see ai.py's
    _notify_new_prediction and api/v1/notifications.py."""
    patient = _make_patient(db_session, guardian_id=None, doctor_id=None)
    # Register real users so the ids are valid User rows, then attach them.
    import uuid

    from database.models import User

    guardian = User(email=f"g-{uuid.uuid4().hex[:8]}@example.com", hashed_password="x", full_name="G", is_active=True)
    doctor = User(email=f"d-{uuid.uuid4().hex[:8]}@example.com", hashed_password="x", full_name="D", is_active=True)
    db_session.add_all([guardian, doctor])
    db_session.commit()
    db_session.refresh(guardian)
    db_session.refresh(doctor)

    patient.guardian_id = guardian.id
    patient.doctor_id = doctor.id
    db_session.commit()

    client.post("/api/v1/ai/tabular", json={"patient_id": patient.id, "features": [0.4] * FEATURE_COUNT})

    from database.models import Notification

    notif_user_ids = {n.user_id for n in db_session.query(Notification).all()}
    assert guardian.id in notif_user_ids
    assert doctor.id in notif_user_ids


# --- MRI ------------------------------------------------------------------


def test_mri_predict_is_tagged_demo_mode(client, db_session):
    patient = _make_patient(db_session)
    files = {"file": ("scan.png", _synthetic_png_bytes(), "image/png")}
    resp = client.post(f"/api/v1/ai/mri?patient_id={patient.id}", files=files)
    assert resp.status_code == 200
    body = resp.json()
    assert body["inference_mode"] == "demo"
    assert "demo_note" in body
    assert 0.0 <= body["adhd_probability_pct"] <= 100.0
    assert isinstance(body["findings"], list) and len(body["findings"]) > 0
    assert body["slice_image_base64"]
    assert body["heatmap_image_base64"]


def test_mri_predict_rejects_empty_file(client, db_session):
    patient = _make_patient(db_session)
    files = {"file": ("scan.png", b"", "image/png")}
    resp = client.post(f"/api/v1/ai/mri?patient_id={patient.id}", files=files)
    assert resp.status_code == 400


def test_mri_predict_rejects_unsupported_extension(client, db_session):
    patient = _make_patient(db_session)
    files = {"file": ("scan.txt", b"not an image", "text/plain")}
    resp = client.post(f"/api/v1/ai/mri?patient_id={patient.id}", files=files)
    assert resp.status_code == 400


def test_mri_predict_unknown_patient_404s(client):
    files = {"file": ("scan.png", _synthetic_png_bytes(), "image/png")}
    resp = client.post("/api/v1/ai/mri?patient_id=999999", files=files)
    assert resp.status_code == 404