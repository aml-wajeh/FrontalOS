"""
Exercises app.core.inference_engine.InferenceEngine directly with
synthetic frames -- this is the "short sample video or synthetic frame
array" pipeline test called for in REMAINING_STEPS.md item 4, run against
the demo-mode code path since no torch/model weights are available in
this environment (see conftest.py docstring).
"""
import time

from app.core.inference_engine import InferenceEngine
from app.core.model import NUM_FRAMES
from tests.conftest import make_synthetic_frame


def test_demo_engine_produces_result_without_any_frames():
    """Demo mode emits on a fixed cadence, independent of frame arrival --
    the frontend must always have something to render even before the
    webcam has sent anything."""
    engine = InferenceEngine(model=None, device=None, model_status_loaded=False)
    try:
        assert engine.demo_mode is True
        deadline = time.time() + 3.0
        while engine.get_latest_result() is None and time.time() < deadline:
            time.sleep(0.05)
        result = engine.get_latest_result()
        assert result is not None
        assert result.inference_mode == "demo"
    finally:
        engine.stop()


def test_demo_engine_values_are_well_formed_and_in_range():
    engine = InferenceEngine(model=None, device=None, model_status_loaded=False)
    try:
        deadline = time.time() + 3.0
        result = None
        while time.time() < deadline:
            result = engine.get_latest_result()
            if result is not None:
                break
            time.sleep(0.05)
        assert result is not None
        assert len(result.values) == 4  # boredom, engagement, confusion, frustration
        for v in result.values:
            assert 0.0 <= v <= 1.0
    finally:
        engine.stop()


def test_demo_engine_updates_over_time():
    """Successive reads should not be frozen on the very first value --
    the worker loop must keep advancing its synthetic signal."""
    engine = InferenceEngine(model=None, device=None, model_status_loaded=False)
    try:
        deadline = time.time() + 3.0
        while engine.get_latest_result() is None and time.time() < deadline:
            time.sleep(0.05)
        first = engine.get_latest_result()
        assert first is not None

        time.sleep(1.2)  # >2 demo ticks at the engine's 0.5s cadence
        second = engine.get_latest_result()
        assert second is not None
        assert second.values != first.values
    finally:
        engine.stop()


def test_push_frame_accepts_synthetic_frames_up_to_buffer_size():
    """Pushing more than NUM_FRAMES frames must not grow the buffer past
    its rolling window (it's a maxlen deque)."""
    engine = InferenceEngine(model=None, device=None, model_status_loaded=False)
    try:
        for i in range(NUM_FRAMES + 10):
            engine.push_frame(make_synthetic_frame(seed=i))
        assert len(engine.buffer) == NUM_FRAMES
    finally:
        engine.stop()


def test_engine_without_model_never_attempts_real_inference():
    """demo_mode=True must be driven purely by model_status_loaded, so a
    None model can never be called."""
    engine = InferenceEngine(model=None, device=None, model_status_loaded=False)
    try:
        assert engine.model is None
        for i in range(NUM_FRAMES):
            engine.push_frame(make_synthetic_frame(seed=i))
        deadline = time.time() + 3.0
        while engine.get_latest_result() is None and time.time() < deadline:
            time.sleep(0.05)
        # No exception raised despite model=None -- proves the demo path,
        # not the real-inference path (which would call self.model(...)),
        # is what actually ran.
        assert engine.get_latest_result() is not None
    finally:
        engine.stop()
