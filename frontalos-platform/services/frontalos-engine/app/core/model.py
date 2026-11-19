"""
core/model.py

Model construction and loading for the FrontalOS engagement/affect regression
model, ported EXACTLY from the reference `train.py` (build_model) and
`live_observer.py` (load_model) — only the weights path is made configurable
via an environment variable, and loading is wrapped so a missing checkpoint
or missing torch/CUDA never crashes the service (see `ModelStatus`).

Original architecture (unchanged):
    - Backbone: pytorchvideo's `x3d_xs` (Kinetics-400 pretrained, X3D-XS).
    - Head swap: the final block's `proj` Linear layer is replaced with a
      4-output regression head (Boredom, Engagement, Confusion, Frustration).
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from pathlib import Path

logger = logging.getLogger("frontalos_engine.model")

LABEL_NAMES = ["Boredom", "Engagement", "Confusion", "Frustration"]
NUM_LABELS = 4
NUM_FRAMES = 16
FRAME_SIZE = 224

DEFAULT_MODEL_PATH = "./models/frontal_x3d_v2.pth"
DEFAULT_MODEL_VERSION = "v2"

# DAiSEE labels are ordinal levels 0..3. v2 outputs are on that scale and are
# divided by this to give the [0, 1] values the API and UI use.
LABEL_MAX = 3.0
KINETICS_MEAN = (0.45, 0.45, 0.45)
KINETICS_STD = (0.225, 0.225, 0.225)


@dataclass
class ModelStatus:
    """Reported by GET /health and used to decide real vs. demo inference."""

    loaded: bool
    device: str
    reason: str | None = None
    model_path: str | None = None
    model_version: str = DEFAULT_MODEL_VERSION
    torch_available: bool = False
    cuda_available: bool = False


def _model_path() -> Path:
    return Path(os.environ.get("FRONTALOS_MODEL_PATH", DEFAULT_MODEL_PATH))


def model_version() -> str:
    """'v2' (default) or 'v1' for the original checkpoint. Must match how the
    weights were trained -- see FrontalOS_Engine/train.py:build_model."""
    version = os.environ.get("FRONTALOS_MODEL_VERSION", DEFAULT_MODEL_VERSION).lower()
    if version not in ("v1", "v2"):
        raise ValueError(f"FRONTALOS_MODEL_VERSION must be v1 or v2, got {version!r}")
    return version


def _normalize_input(module, args):
    x = args[0]
    mean = x.new_tensor(KINETICS_MEAN).view(1, 3, 1, 1, 1)
    std = x.new_tensor(KINETICS_STD).view(1, 3, 1, 1, 1)
    return ((x - mean) / std,) + tuple(args[1:])


def build_model(num_labels: int = NUM_LABELS, legacy_v1: bool = False):
    """
    Ported verbatim (module names aside) from train.py:build_model.

    Builds a blank X3D-XS architecture WITHOUT downloading pretrained weights
    (pretrained=False). The full fine-tuned state dict — backbone + custom
    4-output regression head — is already baked into the local .pth checkpoint
    (frontal_x3d_model.pth). Loading that file via torch.load() in load_model()
    below populates every layer, so fetching the Kinetics-400 weights from the
    internet first would be both redundant and wrong (they would just be
    overwritten by our load_state_dict call). Setting pretrained=False also
    means the container never needs outbound internet access at runtime.
    """
    from pytorchvideo.models.hub import x3d_xs
    from torch import nn

    # pretrained=False → build blank architecture; weights come from our .pth
    model = x3d_xs(pretrained=False)

    # The final block of an X3D `Net` is the head; its `proj` attribute is
    # the nn.Linear mapping pooled features -> class logits (400 for Kinetics).
    # We replace it with our 4-output regression head before loading the
    # state dict so the shapes match exactly.
    head = model.blocks[-1]
    in_features = head.proj.in_features
    head.proj = nn.Linear(in_features, num_labels)

    # Mirrors FrontalOS_Engine/train.py: v2 drops the head's Softmax (which
    # forced the 4 outputs to sum to 1) and normalizes input inside the model.
    if not legacy_v1:
        head.activation = None
        model.register_forward_pre_hook(_normalize_input)

    return model


def load_model():
    """
    Attempts to load the trained model + weights, mirroring
    live_observer.py:load_model(). Returns (model, device, status).

    Never raises: any failure (torch missing, CUDA unavailable is fine and
    expected, weights file missing, state_dict mismatch, etc.) is captured
    in the returned ModelStatus so the caller can fall back to demo mode.
    """
    try:
        import torch
    except ImportError as e:
        logger.warning("torch is not installed — falling back to demo mode: %s", e)
        return None, None, ModelStatus(
            loaded=False,
            device="cpu",
            reason=f"torch not installed: {e}",
            torch_available=False,
            cuda_available=False,
        )

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    weights_path = _model_path()

    if not weights_path.exists():
        logger.warning("Model weights not found at %s — falling back to demo mode.", weights_path)
        return None, device, ModelStatus(
            loaded=False,
            device=str(device),
            reason=f"weights file not found at {weights_path}",
            model_path=str(weights_path),
            torch_available=True,
            cuda_available=torch.cuda.is_available(),
        )

    try:
        version = model_version()
        model = build_model(NUM_LABELS, legacy_v1=(version == "v1"))
        state_dict = torch.load(weights_path, map_location=device, weights_only=True)
        model.load_state_dict(state_dict)
        model.eval()
        model.to(device)
    except Exception as e:
        logger.exception("Failed to load FrontalOS model — falling back to demo mode.")
        return None, device, ModelStatus(
            loaded=False,
            device=str(device),
            reason=f"failed to load model: {e}",
            model_path=str(weights_path),
            torch_available=True,
            cuda_available=torch.cuda.is_available(),
        )

    logger.info("FrontalOS model loaded on device=%s from %s", device, weights_path)
    return model, device, ModelStatus(
        loaded=True,
        device=str(device),
        model_path=str(weights_path),
        model_version=version,
        torch_available=True,
        cuda_available=torch.cuda.is_available(),
    )
