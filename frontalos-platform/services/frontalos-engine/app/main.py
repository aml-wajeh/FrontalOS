"""
main.py

FastAPI + WebSocket microservice exposing the trained FrontalOS X3D-XS
engagement/affect model over the network, so a browser webcam feed can be
analyzed in real time (replacing live_observer.py's local cv2 window with a
proper network I/O layer; the model + preprocessing are unchanged).

Endpoints
---------
GET  /health                     -> model load status + device
WS   /ws/observe/{session_id}    -> streams base64 JPEG frames in, JSON
                                     predictions out (see docstring below)
"""

from __future__ import annotations

import asyncio
import base64
import binascii
import logging
from datetime import datetime, timezone

import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from .core.focus_score import compute_focus_score
from .core.inference_engine import SessionManager
from .core.model import LABEL_NAMES, load_model

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("frontalos_engine.main")

app = FastAPI(title="FrontalOS Engine", version="1.0.0")

# Permissive CORS by default -- this service is consumed by a browser-side
# webcam client (test_client.html locally, the Next.js Patient Portal in
# production). Tighten via a reverse proxy / env-driven allow-list in prod.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

_model = None
_device = None
_model_status = None
_session_manager: SessionManager | None = None


@app.on_event("startup")
async def startup() -> None:
    global _model, _device, _model_status, _session_manager
    _model, _device, _model_status = load_model()
    _session_manager = SessionManager(_model, _device, model_loaded=_model_status.loaded)
    if _model_status.loaded:
        logger.info("Startup complete — model loaded, device=%s", _model_status.device)
    else:
        logger.warning("Startup complete — running in DEMO mode (reason: %s)", _model_status.reason)


@app.get("/health")
async def health() -> dict:
    """Model load status and device (cuda/cpu), for readiness checks and the
    frontend to know whether it's seeing real or demo inference."""
    return {
        "status": "ok",
        "model_loaded": _model_status.loaded if _model_status else False,
        "inference_mode": "model" if (_model_status and _model_status.loaded) else "demo",
        "device": _model_status.device if _model_status else "unknown",
        "reason": _model_status.reason if _model_status else None,
        "torch_available": _model_status.torch_available if _model_status else False,
        "cuda_available": _model_status.cuda_available if _model_status else False,
        "active_sessions": _session_manager.active_count() if _session_manager else 0,
        "labels": LABEL_NAMES,
    }


def _decode_jpeg_b64_to_bgr(raw: bytes) -> np.ndarray:
    """
    Decodes a base64-encoded JPEG (sent as a WebSocket binary or text
    message) into a BGR frame, matching the array layout cv2.VideoCapture
    would have produced in the original desktop app.
    """
    import cv2

    try:
        jpg_bytes = base64.b64decode(raw, validate=False)
    except binascii.Error as e:
        raise ValueError(f"invalid base64 payload: {e}") from e

    arr = np.frombuffer(jpg_bytes, dtype=np.uint8)
    frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if frame is None:
        raise ValueError("could not decode JPEG frame")
    return frame


@app.websocket("/ws/observe/{session_id}")
async def observe(websocket: WebSocket, session_id: str) -> None:
    """
    Real-time observation endpoint.

    Protocol
    --------
    1. Client connects to ws://<host>/ws/observe/{session_id}.
    2. Client repeatedly sends JPEG frames as base64-encoded messages
       (binary or text), throttled client-side to ~5-10 fps.
    3. Server decodes each frame and feeds it into a per-session
       InferenceEngine (one instance per session_id, a rolling 16-frame
       buffer + background worker thread, cleaned up on disconnect / idle
       timeout).
    4. Whenever a new prediction is ready, the server pushes back:
           {
             "boredom": float, "engagement": float,
             "confusion": float, "frustration": float,
             "focus_score": float,
             "inference_mode": "model" | "demo",
             "timestamp": iso8601
           }
    """
    await websocket.accept()

    if _session_manager is None:
        await websocket.close(code=1011, reason="server not ready")
        return

    engine = _session_manager.get_or_create(session_id)

    async def receive_loop() -> None:
        """Reads incoming JPEG frames from the client and feeds the engine."""
        while True:
            message = await websocket.receive()

            if message.get("type") == "websocket.disconnect":
                raise WebSocketDisconnect(code=message.get("code", 1000))

            if "bytes" in message and message["bytes"] is not None:
                payload = message["bytes"]
            elif "text" in message and message["text"] is not None:
                payload = message["text"].encode("ascii")
            else:
                continue

            try:
                frame_bgr = _decode_jpeg_b64_to_bgr(payload)
            except ValueError as e:
                logger.debug("Skipping bad frame for session=%s: %s", session_id, e)
                continue

            engine.push_frame(frame_bgr)

    async def send_loop() -> None:
        """
        Independently polls the engine's latest prediction and pushes a new
        JSON message whenever it changes -- decoupled from frame arrival, so
        pushes keep flowing (e.g. in demo mode, or if the model is slower
        than the client's frame rate) as long as the socket is open.
        """
        last_sent_result_id = None
        while True:
            result = engine.get_latest_result()
            if result is not None:
                result_id = id(result)
                if result_id != last_sent_result_id:
                    last_sent_result_id = result_id
                    boredom, engagement, confusion, frustration = (
                        result.values + [0.0, 0.0, 0.0, 0.0]
                    )[:4]
                    focus_score = compute_focus_score(boredom, engagement, confusion, frustration)
                    await websocket.send_json({
                        "boredom": boredom,
                        "engagement": engagement,
                        "confusion": confusion,
                        "frustration": frustration,
                        "focus_score": focus_score,
                        "inference_mode": result.inference_mode,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    })
            await asyncio.sleep(0.1)

    receive_task = asyncio.ensure_future(receive_loop())
    send_task = asyncio.ensure_future(send_loop())

    try:
        done, pending = await asyncio.wait(
            [receive_task, send_task], return_when=asyncio.FIRST_EXCEPTION
        )
        for task in pending:
            task.cancel()
        for task in done:
            exc = task.exception()
            if exc is not None and not isinstance(exc, WebSocketDisconnect):
                raise exc
    except WebSocketDisconnect:
        logger.info("Session %s disconnected", session_id)
    except Exception:  # noqa: BLE001
        logger.exception("Unexpected error in session %s", session_id)
    finally:
        receive_task.cancel()
        send_task.cancel()
        _session_manager.remove(session_id)
