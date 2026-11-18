"""
train.py

Training script for multi-output regression (Boredom, Engagement, Confusion,
Frustration) on the DAiSEE dataset using a lightweight X3D 3D-CNN backbone.

Optimized for a single RTX 3050 (4GB VRAM):
    - x3d_xs backbone (smallest X3D variant)
    - Small physical batch size (default 2)
    - Gradient accumulation to simulate a larger effective batch size
    - Automatic Mixed Precision (AMP) to cut activation memory ~2x
    - Gradient clipping for stability under mixed precision
    - torch.cuda.empty_cache() hygiene between phases
"""

from __future__ import annotations

import copy
import time
from pathlib import Path

import torch
import torch.nn as nn
from torch.optim import AdamW
from torch.optim.lr_scheduler import ReduceLROnPlateau
from torch.utils.data import DataLoader

from pytorchvideo.models.hub import x3d_xs

from dataset_loader import DAiSEEDataset

# --------------------------------------------------------------------------- #
# Configuration
# --------------------------------------------------------------------------- #
DATASET_ROOT = r"D:\ADHD_FINAL_PROJECT\Dataset"

BATCH_SIZE = 2                 # physical batch size actually sent to the GPU
ACCUMULATION_STEPS = 8         # effective batch size = BATCH_SIZE * ACCUMULATION_STEPS = 16
NUM_WORKERS = 2                # keep low; raise only if I/O bound and RAM allows
EPOCHS = 30
LEARNING_RATE = 1e-4
WEIGHT_DECAY = 1e-4
GRAD_CLIP_NORM = 1.0
NUM_LABELS = 4                 # Boredom, Engagement, Confusion, Frustration

SAVE_PATH = Path("frontal_x3d_model.pth")

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")


# --------------------------------------------------------------------------- #
# Model construction
# --------------------------------------------------------------------------- #
def build_model(num_labels: int = NUM_LABELS) -> nn.Module:
    """
    Loads the pretrained X3D-XS backbone (Kinetics-400) and swaps the final
    classification projection layer for a 4-output regression head.

    X3D's head (ResNetBasicHead) ends with a global adaptive average pool
    over (T, H, W) before the linear projection, so it is agnostic to the
    exact number of input frames (16 in our case) -- no architecture surgery
    beyond the final Linear layer is required.
    """
    model = x3d_xs(pretrained=True)

    # The final block of an X3D `Net` is the head; its `proj` attribute is
    # the nn.Linear mapping pooled features -> class logits (400 for Kinetics).
    head = model.blocks[-1]
    in_features = head.proj.in_features
    head.proj = nn.Linear(in_features, num_labels)

    return model


# --------------------------------------------------------------------------- #
# Train / validate for a single epoch
# --------------------------------------------------------------------------- #
def run_epoch(
    model: nn.Module,
    loader: DataLoader,
    criterion: nn.Module,
    optimizer: AdamW | None,
    scaler: torch.cuda.amp.GradScaler | None,
    device: torch.device,
    train: bool,
    accumulation_steps: int = ACCUMULATION_STEPS,
) -> float:
    """
    Runs one full pass over `loader`. If `train=True`, performs backprop with
    gradient accumulation + AMP; otherwise runs a no-grad validation pass.
    Returns the mean loss over the epoch.
    """
    model.train(mode=train)
    running_loss = 0.0
    num_batches = 0

    if train:
        optimizer.zero_grad(set_to_none=True)

    context = torch.enable_grad() if train else torch.no_grad()
    with context:
        for step, (videos, labels) in enumerate(loader):
            videos = videos.to(device, non_blocking=True)
            labels = labels.to(device, non_blocking=True)

            with torch.autocast(device_type=device.type, enabled=(device.type == "cuda")):
                predictions = model(videos)
                loss = criterion(predictions, labels)

            if train:
                # Normalize loss so accumulated gradients match the effective
                # batch size (BATCH_SIZE * accumulation_steps).
                scaled_loss = loss / accumulation_steps
                scaler.scale(scaled_loss).backward()

                is_accumulation_boundary = (step + 1) % accumulation_steps == 0
                is_last_batch = (step + 1) == len(loader)
                if is_accumulation_boundary or is_last_batch:
                    scaler.unscale_(optimizer)
                    torch.nn.utils.clip_grad_norm_(model.parameters(), GRAD_CLIP_NORM)
                    scaler.step(optimizer)
                    scaler.update()
                    optimizer.zero_grad(set_to_none=True)

            running_loss += loss.item()
            num_batches += 1

    return running_loss / max(num_batches, 1)


# --------------------------------------------------------------------------- #
# Main
# --------------------------------------------------------------------------- #
def main() -> None:
    print(f"Device: {DEVICE}")
    if DEVICE.type == "cuda":
        print(f"GPU: {torch.cuda.get_device_name(0)}")

    # ----------------------------- Data ----------------------------------- #
    train_dataset = DAiSEEDataset(split="Train", root_dir=DATASET_ROOT)
    val_dataset = DAiSEEDataset(split="Validation", root_dir=DATASET_ROOT)

    train_loader = DataLoader(
        train_dataset,
        batch_size=BATCH_SIZE,
        shuffle=True,
        num_workers=NUM_WORKERS,
        pin_memory=(DEVICE.type == "cuda"),
        drop_last=True,  # keeps accumulation-step arithmetic clean
    )
    val_loader = DataLoader(
        val_dataset,
        batch_size=BATCH_SIZE,
        shuffle=False,
        num_workers=NUM_WORKERS,
        pin_memory=(DEVICE.type == "cuda"),
    )

    # ----------------------------- Model ----------------------------------- #
    model = build_model(NUM_LABELS).to(DEVICE)

    criterion = nn.MSELoss()
    optimizer = AdamW(model.parameters(), lr=LEARNING_RATE, weight_decay=WEIGHT_DECAY)
    scheduler = ReduceLROnPlateau(optimizer, mode="min", factor=0.5, patience=3)
    scaler = torch.cuda.amp.GradScaler(enabled=(DEVICE.type == "cuda"))

    best_val_loss = float("inf")
    best_state_dict = None

    print(
        f"Physical batch size: {BATCH_SIZE} | Accumulation steps: {ACCUMULATION_STEPS} "
        f"| Effective batch size: {BATCH_SIZE * ACCUMULATION_STEPS}"
    )
    print(f"Train samples: {len(train_dataset)} | Validation samples: {len(val_dataset)}")

    # ----------------------------- Loop ----------------------------------- #
    for epoch in range(1, EPOCHS + 1):
        epoch_start = time.time()

        train_loss = run_epoch(
            model, train_loader, criterion, optimizer, scaler, DEVICE, train=True
        )

        if DEVICE.type == "cuda":
            torch.cuda.empty_cache()

        val_loss = run_epoch(
            model, val_loader, criterion, optimizer=None, scaler=None, device=DEVICE, train=False
        )

        scheduler.step(val_loss)
        current_lr = optimizer.param_groups[0]["lr"]
        elapsed = time.time() - epoch_start

        print(
            f"Epoch [{epoch:03d}/{EPOCHS}] "
            f"Train MSE: {train_loss:.4f} | Val MSE: {val_loss:.4f} | "
            f"LR: {current_lr:.2e} | Time: {elapsed:.1f}s"
        )

        if val_loss < best_val_loss:
            best_val_loss = val_loss
            best_state_dict = copy.deepcopy(model.state_dict())
            torch.save(best_state_dict, SAVE_PATH)
            print(f"  -> New best model saved to '{SAVE_PATH}' (Val MSE: {best_val_loss:.4f})")

        if DEVICE.type == "cuda":
            torch.cuda.empty_cache()

    print(f"\nTraining complete. Best validation MSE: {best_val_loss:.4f}")
    print(f"Best weights saved at: {SAVE_PATH.resolve()}")


if __name__ == "__main__":
    main()
