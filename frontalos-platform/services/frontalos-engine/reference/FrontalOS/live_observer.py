"""
live_observer.py

Real-time webcam inference for the trained X3D-XS engagement/affect
regression model. Captures frames continuously, maintains a rolling 16-frame
buffer, and runs inference asynchronously in a background thread so the
webcam feed never blocks waiting on the GPU.
"""

from __future__ import annotations

import collections
import threading
import time

import cv2
import numpy as np
import torch

from train import build_model, DEVICE, NUM_LABELS, SAVE_PATH

LABEL_NAMES = ["Boredom", "Engagement", "Confusion", "Frustration"]
NUM_FRAMES = 16
FRAME_SIZE = 224


class InferenceEngine:
    """
    Owns the rolling frame buffer and runs the model on a background thread.
    The main (capture/render) thread only ever reads the latest cached
    prediction, so UI framerate is decoupled from inference latency.
    """

    def __init__(self, model: torch.nn.Module, device: torch.device):
        self.model = model
        self.device = device
        self.buffer: collections.deque[np.ndarray] = collections.deque(maxlen=NUM_FRAMES)
        self.lock = threading.Lock()
        self.latest_predictions: list[float] | None = None
        self.running = True
        self.new_frame_event = threading.Event()
        self.thread = threading.Thread(target=self._worker_loop, daemon=True)
        self.thread.start()

    def push_frame(self, frame_bgr: np.ndarray) -> None:
        with self.lock:
            self.buffer.append(frame_bgr.copy())
        self.new_frame_event.set()

    def get_predictions(self) -> list[float] | None:
        with self.lock:
            return self.latest_predictions

    def stop(self) -> None:
        self.running = False
        self.new_frame_event.set()
        self.thread.join(timeout=1.0)

    def _preprocess(self, frames: list[np.ndarray]) -> torch.Tensor:
        processed = []
        for frame in frames:
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            resized = cv2.resize(rgb, (FRAME_SIZE, FRAME_SIZE), interpolation=cv2.INTER_AREA)
            processed.append(resized)

        clip = np.stack(processed, axis=0).astype(np.float32) / 255.0  # (T, H, W, C)
        tensor = torch.from_numpy(clip).permute(3, 0, 1, 2).unsqueeze(0)  # (1, C, T, H, W)
        return tensor.to(self.device, non_blocking=True)

    def _worker_loop(self) -> None:
        while self.running:
            self.new_frame_event.wait(timeout=0.1)
            self.new_frame_event.clear()

            with self.lock:
                if len(self.buffer) < NUM_FRAMES:
                    continue
                frames_snapshot = list(self.buffer)

            try:
                input_tensor = self._preprocess(frames_snapshot)
                with torch.no_grad():
                    if self.device.type == "cuda":
                        with torch.autocast(device_type="cuda"):
                            output = self.model(input_tensor)
                    else:
                        output = self.model(input_tensor)
                predictions = output.squeeze(0).float().cpu().numpy().tolist()
                with self.lock:
                    self.latest_predictions = predictions
            except Exception as e:
                print(f"[InferenceEngine] Inference error (skipped frame): {e}")


def load_model() -> torch.nn.Module:
    model = build_model(NUM_LABELS)
    state_dict = torch.load(SAVE_PATH, map_location=DEVICE)
    model.load_state_dict(state_dict)
    model.eval()
    model.to(DEVICE)
    return model


def draw_overlay(frame: np.ndarray, predictions: list[float] | None, fps: float) -> None:
    font = cv2.FONT_HERSHEY_SIMPLEX
    line_height = 28
    panel_height = line_height * (len(LABEL_NAMES) + 2) + 10
    panel_width = 300

    overlay = frame.copy()
    cv2.rectangle(overlay, (0, 0), (panel_width, panel_height), (0, 0, 0), -1)
    cv2.addWeighted(overlay, 0.55, frame, 0.45, 0, frame)

    x, y = 12, 28
    if predictions is None:
        cv2.putText(frame, "Buffering frames...", (x, y), font, 0.6, (0, 255, 255), 2)
    else:
        for i, (name, value) in enumerate(zip(LABEL_NAMES, predictions)):
            text = f"{name}: {value:.2f}"
            cv2.putText(frame, text, (x, y + i * line_height), font, 0.62, (0, 255, 0), 2)

    fps_y = y + len(LABEL_NAMES) * line_height + 10
    cv2.putText(frame, f"FPS: {fps:.1f}", (x, fps_y), font, 0.55, (255, 255, 0), 2)


def main() -> None:
    print(f"Loading model on device: {DEVICE}")
    model = load_model()
    engine = InferenceEngine(model, DEVICE)

    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        raise RuntimeError("Could not open webcam (index 0).")

    prev_time = time.time()
    window_name = "Live Engagement Observer (press 'q' to quit)"

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                print("Failed to read frame from webcam.")
                break

            engine.push_frame(frame)
            predictions = engine.get_predictions()

            now = time.time()
            fps = 1.0 / (now - prev_time) if now > prev_time else 0.0
            prev_time = now

            draw_overlay(frame, predictions, fps)
            cv2.imshow(window_name, frame)

            if cv2.waitKey(1) & 0xFF == ord("q"):
                break
    finally:
        engine.stop()
        cap.release()
        cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
