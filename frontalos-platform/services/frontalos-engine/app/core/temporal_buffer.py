"""
core/temporal_buffer.py

Fixes the train/serve temporal skew of v1.

Training clips are 16 frames sampled uniformly across a whole DAiSEE video
(~10 seconds). v1's live engine fed the model the last 16 *consecutive*
frames instead (~0.5 s at 30 fps, ~2.4 s at the browser's ~6.7 fps), so the
model saw a very different input at serve time than at train time.

`TemporalFrameBuffer` keeps a time-stamped window of the last
`window_seconds` and samples `num_frames` frames uniformly across it, which
is how training clips were built. Frames are downscaled on arrival and only
stored every `window_seconds / (2 * num_frames)` seconds, so memory stays
bounded (~2 x num_frames small frames) whatever the camera's frame rate.

Pure NumPy + an injectable clock, so it is fully unit-testable.
"""

from __future__ import annotations

import collections
import time
from collections.abc import Callable

import numpy as np

DAISEE_CLIP_SECONDS = 10.0


class TemporalFrameBuffer:
    def __init__(
        self,
        num_frames: int = 16,
        window_seconds: float = DAISEE_CLIP_SECONDS,
        min_fill: float = 0.9,
        resize_to: int | None = 224,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        if num_frames < 2:
            raise ValueError("num_frames must be >= 2")
        self.num_frames = num_frames
        self.window_seconds = window_seconds
        self.min_fill = min_fill
        self.resize_to = resize_to
        self.clock = clock
        self.store_interval = window_seconds / (2 * num_frames)
        self._frames: collections.deque[tuple[float, np.ndarray]] = collections.deque()

    def __len__(self) -> int:
        return len(self._frames)

    def clear(self) -> None:
        self._frames.clear()

    def push(self, frame: np.ndarray, timestamp: float | None = None) -> bool:
        """Adds a frame. Returns True if it was stored (rate-limited)."""
        now = self.clock() if timestamp is None else timestamp
        if self._frames and now - self._frames[-1][0] < self.store_interval:
            return False
        if self.resize_to is not None and frame.shape[:2] != (self.resize_to, self.resize_to):
            import cv2  # local import keeps the module importable without OpenCV in tests

            frame = cv2.resize(frame, (self.resize_to, self.resize_to), interpolation=cv2.INTER_AREA)
        self._frames.append((now, frame.copy()))
        while self._frames and now - self._frames[0][0] > self.window_seconds:
            self._frames.popleft()
        return True

    def span_seconds(self) -> float:
        if len(self._frames) < 2:
            return 0.0
        return self._frames[-1][0] - self._frames[0][0]

    def is_ready(self) -> bool:
        """True once the buffer covers enough of the window to match training."""
        return len(self._frames) >= self.num_frames and self.span_seconds() >= self.min_fill * self.window_seconds

    def sample(self) -> list[np.ndarray] | None:
        """`num_frames` frames spread uniformly over the buffered window, or
        None while warming up. Picks the stored frame nearest each target time."""
        if not self.is_ready():
            return None
        times = np.array([t for t, _ in self._frames])
        targets = np.linspace(times[0], times[-1], self.num_frames)
        idx = np.abs(times[None, :] - targets[:, None]).argmin(axis=1)
        return [self._frames[i][1] for i in idx]
