"""
End-to-end test of the /ws/observe/{session_id} pipeline: encodes
synthetic frames as base64 JPEG exactly like the browser client would,
sends them over a real WebSocket connection, and asserts the JSON
predictions coming back are well-formed and in expected value ranges.

Runs against the demo-mode fallback (see conftest.py) since no
torch/model weights are available in this environment -- this still
exercises the full real pipeline: WS handshake -> frame decode ->
InferenceEngine -> focus_score -> JSON push.
"""
from fastapi.testclient import TestClient

from app.main import app
from tests.conftest import make_synthetic_jpeg_b64

EXPECTED_KEYS = {
    "boredom",
    "engagement",
    "confusion",
    "frustration",
    "focus_score",
    "inference_mode",
    "timestamp",
}


def test_health_reports_demo_mode_without_torch():
    with TestClient(app) as client:
        resp = client.get("/health")
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "ok"
        assert body["inference_mode"] == "demo"
        assert body["model_loaded"] is False
        assert body["labels"] == ["Boredom", "Engagement", "Confusion", "Frustration"]


def test_websocket_pushes_well_formed_predictions_for_synthetic_frames():
    with TestClient(app) as client:
        with client.websocket_connect("/ws/observe/test-session-1") as ws:
            # Send a handful of synthetic frames, as the browser client
            # would at ~5-10fps.
            for i in range(5):
                ws.send_text(make_synthetic_jpeg_b64(seed=i).decode("ascii"))

            message = ws.receive_json()

            assert EXPECTED_KEYS.issubset(message.keys())
            assert message["inference_mode"] in ("model", "demo")

            for field in ("boredom", "engagement", "confusion", "frustration"):
                assert 0.0 <= message[field] <= 1.0

            assert 0.0 <= message["focus_score"] <= 10.0
            # ISO 8601 timestamp should be parseable.
            from datetime import datetime

            datetime.fromisoformat(message["timestamp"])


def test_websocket_active_session_count_reflected_in_health():
    with TestClient(app) as client:
        with client.websocket_connect("/ws/observe/test-session-2") as ws:
            ws.send_text(make_synthetic_jpeg_b64(seed=1).decode("ascii"))
            ws.receive_json()

            resp = client.get("/health")
            assert resp.json()["active_sessions"] >= 1


def test_websocket_ignores_malformed_frame_without_crashing():
    with TestClient(app) as client:
        with client.websocket_connect("/ws/observe/test-session-3") as ws:
            ws.send_text("not-valid-base64-jpeg!!!")
            # The engine still emits demo-mode readings on its own cadence
            # even though the bad frame was discarded -- the socket must
            # stay open and keep producing well-formed messages.
            message = ws.receive_json()
            assert EXPECTED_KEYS.issubset(message.keys())
