"""
Shared fixtures for the frontalos-engine test suite.

No trained-model weights are exercised here on purpose: this environment
has no `torch`/`pytorchvideo` installed (and no network access to fetch
the pretrained X3D-XS backbone even if it were), so `core.model.load_model()`
always degrades to its documented "torch not installed" demo-mode path —
exactly the same honest-fallback contract the cortix-api AI tests lock in
for its own demo mode. These tests therefore validate the *pipeline*
(frame ingestion -> engine -> focus score -> WebSocket JSON) end to end
using synthetic frames, and the demo-mode value generator's output shape,
rather than the real model's numerical accuracy.
"""
import sys
from pathlib import Path

import numpy as np
import pytest

# app/ uses relative imports (`from .core...`), so the package root
# (services/frontalos-engine) must be on sys.path for `import app.main`
# to resolve, same as when uvicorn is launched from this directory.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def make_synthetic_frame(width: int = 320, height: int = 240, seed: int = 0) -> np.ndarray:
    """A deterministic synthetic BGR frame (uint8), standing in for a
    webcam capture — no real camera or video file needed."""
    rng = np.random.default_rng(seed)
    return rng.integers(0, 255, size=(height, width, 3), dtype=np.uint8)


def make_synthetic_jpeg_b64(width: int = 320, height: int = 240, seed: int = 0) -> bytes:
    """A synthetic frame encoded exactly like the browser client would
    encode a webcam frame before sending it over the WebSocket."""
    import base64
    import cv2

    frame = make_synthetic_frame(width, height, seed)
    ok, buf = cv2.imencode(".jpg", frame)
    assert ok
    return base64.b64encode(buf.tobytes())


@pytest.fixture()
def synthetic_frame():
    return make_synthetic_frame()


@pytest.fixture()
def synthetic_jpeg_b64():
    return make_synthetic_jpeg_b64()
