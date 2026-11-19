"""
live_observer.py

Real-time webcam inference for the X3D-XS engagement/affect model.

Frames are captured continuously; a background thread scores the last ~10 s
of video (16 frames sampled uniformly across the window, matching how the
training clips were built) about once a second, so the video feed never
blocks on the GPU.

v2 changes vs. v1:
  - temporal buffer instead of the last 16 consecutive frames (train/serve skew fix)
  - v2 model (no softmax head, Kinetics normalization); `--legacy-v1` runs the old one
  - overlay shows model inference latency, not just the camera loop's FPS
  - inference errors are logged with a traceback instead of a bare print

Usage:
    python live_observer.py                 # v2 weights (frontal_x3d_v2.pth)
    python live_observer.py --legacy-v1     # original v1 weights
"""

from __future__ import annotations

import argparse
import logging
import threading
import time
from pathlib import Path

import cv2
import numpy as np
import torch

from temporal_buffer import TemporalFrameBuffer
from train import DEVICE, NUM_LABELS, build_model

logger = logging.getLogger("live_observer")

HERE = Path(__file__).resolve().parent
LABEL_NAMES = ["Boredom", "Engagement", "Confusion", "Frustration"]
NUM_FRAMES = 16
FRAME_SIZE = 224
INFERENCE_INTERVAL_SECONDS = 1.0


class InferenceEngine:
    """Owns the temporal frame buffer and runs the model on a background
    thread. The capture/render loop only reads the latest cached prediction."""

    def __init__(self, model: torch.nn.Module, device: torch.device):
        self.model = model
        self.device = device
        self.buffer = TemporalFrameBuffer(num_frames=NUM_FRAMES, resize_to=FRAME_SIZE)
        self.lock = threading.Lock()
        self.latest_predictions: list[float] | None = None
        self.latest_latency_ms: float | None = None
        self.running = True
        self.thread = threading.Thread(target=self._worker_loop, daemon=True)
        self.thread.start()

    def push_frame(self, frame_bgr: np.ndarray) -> None:
        with self.lock:
            self.buffer.push(frame_bgr)

    def get_state(self) -> tuple[list[float] | None, float | None, float]:
        with self.lock:
            return self.latest_predictions, self.latest_latency_ms, self.buffer.span_seconds()

    def stop(self) -> None:
        self.running = False
        self.thread.join(timeout=2.0)

    def _preprocess(self, frames: list[np.ndarray]) -> torch.Tensor:
        rgb = [cv2.cvtColor(f, cv2.COLOR_BGR2RGB) for f in frames]  # already 224x224
        clip = np.stack(rgb, axis=0).astype(np.float32) / 255.0  # (T, H, W, C)
        return torch.from_numpy(clip).permute(3, 0, 1, 2).unsqueeze(0).to(self.device, non_blocking=True)

    def _worker_loop(self) -> None:
        while self.running:
            time.sleep(INFERENCE_INTERVAL_SECONDS)
            with self.lock:
                frames = self.buffer.sample()
            if frames is None:
                continue  # warming up: window not full yet
            try:
                start = time.perf_counter()
                tensor = self._preprocess(frames)
                with torch.no_grad(), torch.autocast(device_type=self.device.type,
                                                      enabled=(self.device.type == "cuda")):
                    output = self.model(tensor)
                predictions = output.squeeze(0).float().cpu().numpy().tolist()
                latency_ms = (time.perf_counter() - start) * 1000
                with self.lock:
                    self.latest_predictions = predictions
                    self.latest_latency_ms = latency_ms
            except Exception:  # noqa: BLE001
                logger.exception("Inference failed; skipping this window")


def load_model(weights: Path, legacy_v1: bool) -> torch.nn.Module:
    model = build_model(NUM_LABELS, legacy_v1=legacy_v1, pretrained=False)
    model.load_state_dict(torch.load(weights, map_location=DEVICE, weights_only=True))
    return model.eval().to(DEVICE)


def draw_overlay(frame: np.ndarray, predictions, latency_ms, span_s: float, fps: float, scale: float) -> None:
    font = cv2.FONT_HERSHEY_SIMPLEX
    line_height = 28
    overlay = frame.copy()
    cv2.rectangle(overlay, (0, 0), (330, line_height * (len(LABEL_NAMES) + 3) + 10), (0, 0, 0), -1)
    cv2.addWeighted(overlay, 0.55, frame, 0.45, 0, frame)

    x, y = 12, 28
    if predictions is None:
        cv2.putText(frame, f"Warming up... {span_s:.0f}/10 s", (x, y), font, 0.6, (0, 255, 255), 2)
    else:
        for i, (name, value) in enumerate(zip(LABEL_NAMES, predictions)):
            cv2.putText(frame, f"{name}: {value:.2f} / {scale:.0f}", (x, y + i * line_height),
                        font, 0.62, (0, 255, 0), 2)
    base = y + len(LABEL_NAMES) * line_height + 10
    cv2.putText(frame, f"Camera loop: {fps:.0f} FPS", (x, base), font, 0.55, (255, 255, 0), 2)
    latency = "-" if latency_ms is None else f"{latency_ms:.0f} ms"
    cv2.putText(frame, f"Model latency: {latency}", (x, base + line_height), font, 0.55, (255, 255, 0), 2)


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    parser = argparse.ArgumentParser()
    parser.add_argument("--legacy-v1", action="store_true", help="run the original v1 checkpoint")
    parser.add_argument("--weights", type=Path, default=None)
    parser.add_argument("--camera", type=int, default=0)
    args = parser.parse_args()

    weights = args.weights or HERE / ("frontal_x3d_model.pth" if args.legacy_v1 else "frontal_x3d_v2.pth")
    print(f"Loading {weights.name} on {DEVICE} (legacy_v1={args.legacy_v1})")
    engine = InferenceEngine(load_model(weights, args.legacy_v1), DEVICE)
    # v2 regresses DAiSEE levels 0..3; v1 outputs were softmax values (sum to 1).
    scale = 1.0 if args.legacy_v1 else 3.0

    cap = cv2.VideoCapture(args.camera)
    if not cap.isOpened():
        raise RuntimeError(f"Could not open webcam (index {args.camera}).")

    prev_time = time.time()
    window_name = "FrontalOS Live Observer (q to quit) - nothing is recorded"
    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                print("Failed to read frame from webcam.")
                break
            engine.push_frame(frame)
            predictions, latency_ms, span_s = engine.get_state()

            now = time.time()
            fps = 1.0 / (now - prev_time) if now > prev_time else 0.0
            prev_time = now

            draw_overlay(frame, predictions, latency_ms, span_s, fps, scale)
            cv2.imshow(window_name, frame)
            if cv2.waitKey(1) & 0xFF == ord("q"):
                break
    finally:
        engine.stop()
        cap.release()
        cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
