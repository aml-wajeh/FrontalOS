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
from typing import Optional

logger = logging.getLogger("frontalos_engine.model")

LABEL_NAMES = ["Boredom", "Engagement", "Confusion", "Frustration"]
NUM_LABELS = 4
NUM_FRAMES = 16
FRAME_SIZE = 224

DEFAULT_MODEL_PATH = "./models/frontal_x3d_model.pth"


@dataclass
class ModelStatus:
    """Reported by GET /health and used to decide real vs. demo inference."""

    loaded: bool
    device: str
    reason: Optional[str] = None
    model_path: Optional[str] = None
    torch_available: bool = False
    cuda_available: bool = False


def _model_path() -> Path:
    return Path(os.environ.get("FRONTALOS_MODEL_PATH", DEFAULT_MODEL_PATH))


def build_model(num_labels: int = NUM_LABELS):
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
    import torch.nn as nn
    from pytorchvideo.models.hub import x3d_xs

    # pretrained=False → build blank architecture; weights come from our .pth
    model = x3d_xs(pretrained=False)

    # The final block of an X3D `Net` is the head; its `proj` attribute is
    # the nn.Linear mapping pooled features -> class logits (400 for Kinetics).
    # We replace it with our 4-output regression head before loading the
    # state dict so the shapes match exactly.
    head = model.blocks[-1]
    in_features = head.proj.in_features
    head.proj = nn.Linear(in_features, num_labels)

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
        model = build_model(NUM_LABELS)
        state_dict = torch.load(weights_path, map_location=device)
        model.load_state_dict(state_dict)
        model.eval()
        model.to(device)
    except Exception as e:  # noqa: BLE001 - any load failure must degrade gracefully
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
        torch_available=True,
        cuda_available=torch.cuda.is_available(),
    )
