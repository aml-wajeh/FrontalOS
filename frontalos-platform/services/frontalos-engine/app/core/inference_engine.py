"""
core/inference_engine.py

Session-aware port of live_observer.py's InferenceEngine.

The original InferenceEngine owned a single rolling 16-frame buffer and ran
inference on a background thread so the webcam capture loop never blocked on
the GPU. Here the same design is kept per browser session: a
`SessionManager` holds one `InferenceEngine` per `session_id`, created on
first frame and torn down on disconnect (or after an idle timeout, in case a
socket dies without a clean close).

If the model failed to load (see core/model.py), each engine runs in
"demo" mode: instead of calling the model it emits smooth, randomized
synthetic values on the same cadence, clearly flagged via
`inference_mode: "demo"`, so the frontend can be built/demoed without a GPU
or the weights file present.
"""

from __future__ import annotations

import collections
import logging
import math
import random
import threading
import time
from dataclasses import dataclass, field
from typing import Deque, Dict, List, Optional

import numpy as np

from .model import FRAME_SIZE, LABEL_NAMES, NUM_FRAMES

logger = logging.getLogger("frontalos_engine.inference")

IDLE_TIMEOUT_SECONDS = 60.0
CLEANUP_INTERVAL_SECONDS = 30.0


@dataclass
class PredictionResult:
    values: List[float]  # [boredom, engagement, confusion, frustration]
    inference_mode: str  # "model" | "demo"


class InferenceEngine:
    """
    Owns one session's rolling frame buffer and runs inference on a
    background thread, exactly like the original live_observer.py design,
    but decoupled from cv2 capture/display: frames are pushed in from the
    WebSocket handler instead of a local webcam loop.
    """

    def __init__(self, model, device, model_status_loaded: bool):
        self.model = model
        self.device = device
        self.demo_mode = not model_status_loaded

        self.buffer: Deque[np.ndarray] = collections.deque(maxlen=NUM_FRAMES)
        self.lock = threading.Lock()
        self.latest_result: Optional[PredictionResult] = None
        self.running = True
        self.last_activity = time.time()

        self.new_frame_event = threading.Event()
        self._demo_phase = random.uniform(0, 2 * math.pi)
        self._demo_tick = 0

        self.thread = threading.Thread(target=self._worker_loop, daemon=True)
        self.thread.start()

    def push_frame(self, frame_bgr: np.ndarray) -> None:
        with self.lock:
            self.buffer.append(frame_bgr.copy())
            self.last_activity = time.time()
        self.new_frame_event.set()

    def get_latest_result(self) -> Optional[PredictionResult]:
        with self.lock:
            return self.latest_result

    def stop(self) -> None:
        self.running = False
        self.new_frame_event.set()
        self.thread.join(timeout=1.0)

    def is_idle(self, now: Optional[float] = None) -> bool:
        now = now if now is not None else time.time()
        with self.lock:
            return (now - self.last_activity) > IDLE_TIMEOUT_SECONDS

    # -- internal -----------------------------------------------------

    def _preprocess(self, frames: List[np.ndarray]):
        import cv2
        import torch

        processed = []
        for frame in frames:
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            resized = cv2.resize(rgb, (FRAME_SIZE, FRAME_SIZE), interpolation=cv2.INTER_AREA)
            processed.append(resized)

        clip = np.stack(processed, axis=0).astype(np.float32) / 255.0  # (T, H, W, C)
        tensor = torch.from_numpy(clip).permute(3, 0, 1, 2).unsqueeze(0)  # (1, C, T, H, W)
        return tensor.to(self.device, non_blocking=True)

    def _run_model_inference(self, frames_snapshot: List[np.ndarray]) -> Optional[List[float]]:
        import torch

        try:
            input_tensor = self._preprocess(frames_snapshot)
            with torch.no_grad():
                if self.device.type == "cuda":
                    with torch.autocast(device_type="cuda"):
                        output = self.model(input_tensor)
                else:
                    output = self.model(input_tensor)
            return output.squeeze(0).float().cpu().numpy().tolist()
        except Exception:  # noqa: BLE001
            logger.exception("Inference error (frame skipped)")
            return None

    def _demo_values(self) -> List[float]:
        """Smooth, slowly-drifting synthetic signal for demo mode."""
        self._demo_tick += 1
        t = self._demo_tick * 0.08 + self._demo_phase
        values = [
            0.5 + 0.3 * math.sin(t * 0.7),        # boredom
            0.5 + 0.35 * math.sin(t * 0.5 + 1.2),  # engagement
            0.5 + 0.25 * math.sin(t * 0.9 + 2.4),  # confusion
            0.5 + 0.2 * math.sin(t * 0.6 + 3.6),   # frustration
        ]
        jitter = [random.uniform(-0.02, 0.02) for _ in values]
        return [max(0.0, min(1.0, v + j)) for v, j in zip(values, jitter)]

    def _worker_loop(self) -> None:
        while self.running:
            if self.demo_mode:
                # Emit a synthetic reading on a fixed cadence, independent
                # of frame arrival, so the frontend always has something to
                # render even before/without real frames.
                time.sleep(0.5)
                if not self.running:
                    break
                values = self._demo_values()
                with self.lock:
                    self.latest_result = PredictionResult(values=values, inference_mode="demo")
                continue

            self.new_frame_event.wait(timeout=0.1)
            self.new_frame_event.clear()

            with self.lock:
                if len(self.buffer) < NUM_FRAMES:
                    continue
                frames_snapshot = list(self.buffer)

            predictions = self._run_model_inference(frames_snapshot)
            if predictions is not None:
                with self.lock:
                    self.latest_result = PredictionResult(values=predictions, inference_mode="model")


class SessionManager:
    """Owns one InferenceEngine per active session_id and cleans up idle ones."""

    def __init__(self, model, device, model_loaded: bool):
        self.model = model
        self.device = device
        self.model_loaded = model_loaded
        self._sessions: Dict[str, InferenceEngine] = {}
        self._lock = threading.Lock()
        self._cleanup_thread = threading.Thread(target=self._cleanup_loop, daemon=True)
        self._cleanup_thread.start()

    def get_or_create(self, session_id: str) -> InferenceEngine:
        with self._lock:
            engine = self._sessions.get(session_id)
            if engine is None:
                engine = InferenceEngine(self.model, self.device, self.model_loaded)
                self._sessions[session_id] = engine
                logger.info(
                    "Created InferenceEngine for session=%s (mode=%s) — active sessions: %d",
                    session_id,
                    "demo" if engine.demo_mode else "model",
                    len(self._sessions),
                )
            return engine

    def remove(self, session_id: str) -> None:
        with self._lock:
            engine = self._sessions.pop(session_id, None)
        if engine is not None:
            engine.stop()
            logger.info("Removed InferenceEngine for session=%s", session_id)

    def active_count(self) -> int:
        with self._lock:
            return len(self._sessions)

    def _cleanup_loop(self) -> None:
        while True:
            time.sleep(CLEANUP_INTERVAL_SECONDS)
            now = time.time()
            with self._lock:
                idle_ids = [sid for sid, eng in self._sessions.items() if eng.is_idle(now)]
            for sid in idle_ids:
                logger.info("Session %s idle for >%.0fs — cleaning up", sid, IDLE_TIMEOUT_SECONDS)
                self.remove(sid)
