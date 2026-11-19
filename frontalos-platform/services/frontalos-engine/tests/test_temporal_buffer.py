"""Unit tests for the train/serve-skew fix (app/core/temporal_buffer.py)."""
import numpy as np
import pytest

from app.core.temporal_buffer import TemporalFrameBuffer


def frame(value: int) -> np.ndarray:
    return np.full((4, 4, 3), value, dtype=np.uint8)


def fill(buf: TemporalFrameBuffer, seconds: float, fps: float) -> None:
    n = int(seconds * fps)
    for i in range(n + 1):
        buf.push(frame(i % 256), timestamp=i / fps)


def test_not_ready_until_window_is_covered():
    buf = TemporalFrameBuffer(num_frames=16, window_seconds=10.0, resize_to=None)
    fill(buf, seconds=5.0, fps=30)
    assert not buf.is_ready()
    assert buf.sample() is None


def test_sample_spans_the_whole_window_not_the_last_frames():
    """The v1 bug: 16 consecutive frames covered ~0.5 s. v2 must cover ~10 s."""
    buf = TemporalFrameBuffer(num_frames=16, window_seconds=10.0, resize_to=None)
    fill(buf, seconds=12.0, fps=30)
    assert buf.is_ready()
    clip = buf.sample()
    assert clip is not None and len(clip) == 16
    assert buf.span_seconds() == pytest.approx(10.0, abs=0.5)


def test_storage_is_rate_limited_so_memory_is_bounded():
    buf = TemporalFrameBuffer(num_frames=16, window_seconds=10.0, resize_to=None)
    fill(buf, seconds=60.0, fps=30)
    # stored every 10 / 32 s -> about 33 frames in a 10 s window, never 300
    assert len(buf) <= 2 * 16 + 2


def test_works_at_low_browser_frame_rates():
    buf = TemporalFrameBuffer(num_frames=16, window_seconds=10.0, resize_to=None)
    fill(buf, seconds=11.0, fps=6.7)
    assert buf.is_ready()
    assert len(buf.sample()) == 16


def test_sampled_frames_are_in_time_order():
    buf = TemporalFrameBuffer(num_frames=8, window_seconds=4.0, resize_to=None)
    for i in range(60):
        buf.push(frame(i), timestamp=i * 0.1)
    values = [int(f[0, 0, 0]) for f in buf.sample()]
    assert values == sorted(values)
    assert values[0] < values[-1]


def test_rejects_too_few_frames():
    with pytest.raises(ValueError):
        TemporalFrameBuffer(num_frames=1)
