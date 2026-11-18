"""
dataset_loader.py

Production-ready PyTorch Dataset implementation for the DAiSEE
ADHD / Engagement Detection dataset.

Handles:
    - Reading split manifests (Train.txt / Validation.txt / Test.txt)
    - Reading label CSVs (Boredom, Engagement, Confusion, Frustration)
    - Resolving deeply nested video paths (Split/<UserID>/<ClipDir>/<Clip>.avi)
    - Uniform 16-frame sampling, resize to 224x224, RGB, [0, 1] normalization
    - Graceful handling of corrupt / unreadable videos (auto-skip + retry)

Author: Senior DL Engineering (PyTorch)
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Dict, List, Tuple

import cv2
import numpy as np
import pandas as pd
import torch
from torch.utils.data import DataLoader, Dataset

# --------------------------------------------------------------------------- #
# Logging configuration
# --------------------------------------------------------------------------- #
logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("DAiSEE")

# --------------------------------------------------------------------------- #
# Constants
# --------------------------------------------------------------------------- #
DEFAULT_ROOT = Path(r"D:\ADHD_FINAL_PROJECT\Dataset")
VIDEO_EXTENSIONS = (".avi", ".mp4", ".mov", ".mkv")
NUM_FRAMES = 16
FRAME_SIZE = 224
LABEL_COLUMNS = ["Boredom", "Engagement", "Confusion", "Frustration"]

SPLIT_TO_TXT = {
    "Train": "Train.txt",
    "Validation": "Validation.txt",
    "Test": "Test.txt",
}
SPLIT_TO_CSV = {
    "Train": "TrainLabels.csv",
    "Validation": "ValidationLabels.csv",
    "Test": "TestLabels.csv",
}


class DAiSEEDataset(Dataset):
    """
    PyTorch Dataset for the DAiSEE video engagement/affect dataset.

    Each sample returns:
        video_tensor : torch.FloatTensor of shape (C, T, H, W), values in [0, 1]
        label_tensor : torch.FloatTensor of shape (4,) -> [Boredom, Engagement,
                                                             Confusion, Frustration]
    """

    def __init__(
        self,
        split: str,
        root_dir: str | Path = DEFAULT_ROOT,
        num_frames: int = NUM_FRAMES,
        frame_size: int = FRAME_SIZE,
        max_load_retries: int = 5,
    ) -> None:
        if split not in SPLIT_TO_TXT:
            raise ValueError(f"split must be one of {list(SPLIT_TO_TXT)}, got '{split}'")

        self.split = split
        self.root_dir = Path(root_dir)
        self.num_frames = num_frames
        self.frame_size = frame_size
        self.max_load_retries = max_load_retries

        txt_path = self.root_dir / SPLIT_TO_TXT[split]
        csv_path = self.root_dir / SPLIT_TO_CSV[split]
        # Videos for a split are nested under a folder that (by convention)
        # shares the split's name, e.g. Dataset/Train/<UserID>/<ClipID>/<clip>.avi
        self.split_video_dir = self.root_dir / split

        if not txt_path.exists():
            raise FileNotFoundError(f"Manifest file not found: {txt_path}")
        if not csv_path.exists():
            raise FileNotFoundError(f"Label CSV not found: {csv_path}")
        if not self.split_video_dir.exists():
            raise FileNotFoundError(f"Video directory not found: {self.split_video_dir}")

        self.samples: List[Tuple[Path, torch.Tensor]] = self._build_samples(txt_path, csv_path)

        if len(self.samples) == 0:
            raise RuntimeError(
                f"No valid samples were built for split '{split}'. "
                "Check that video files, the manifest, and the CSV are consistent."
            )

        logger.info(f"[{split}] Loaded {len(self.samples)} valid samples.")

    # ------------------------------------------------------------------ #
    # Construction helpers
    # ------------------------------------------------------------------ #
    def _index_video_files(self) -> Dict[str, Path]:
        """
        Walk the split directory ONCE and build a filename -> absolute path
        lookup table. This avoids an expensive glob() per-video and scales
        well to datasets with tens of thousands of nested clips.
        """
        logger.info(f"Indexing video files under: {self.split_video_dir} (this may take a moment)...")
        index: Dict[str, Path] = {}
        for ext in VIDEO_EXTENSIONS:
            for path in self.split_video_dir.rglob(f"*{ext}"):
                index[path.name] = path
        logger.info(f"Indexed {len(index)} video files.")
        return index

    def _build_samples(self, txt_path: Path, csv_path: Path) -> List[Tuple[Path, torch.Tensor]]:
        # 1. Read manifest filenames
        with open(txt_path, "r", encoding="utf-8") as f:
            filenames = [line.strip() for line in f if line.strip()]

        # 2. Read labels CSV, indexed by ClipID
        df = pd.read_csv(csv_path)
        df.columns = [c.strip() for c in df.columns]
        df["ClipID"] = df["ClipID"].astype(str).str.strip()
        df = df.set_index("ClipID")

        # 3. Build a filename -> path lookup (single filesystem walk)
        path_index = self._index_video_files()

        samples: List[Tuple[Path, torch.Tensor]] = []
        missing_video = 0
        missing_label = 0

        for filename in filenames:
            clip_id = Path(filename).name  # normalize (strip any accidental path prefix)

            video_path = path_index.get(clip_id)
            if video_path is None:
                missing_video += 1
                continue

            # ClipID in CSV may or may not include the extension; try both.
            if clip_id in df.index:
                row = df.loc[clip_id]
            elif Path(clip_id).stem in df.index:
                row = df.loc[Path(clip_id).stem]
            else:
                missing_label += 1
                continue

            try:
                label_values = [float(row[col]) for col in LABEL_COLUMNS]
            except KeyError as e:
                logger.warning(f"Missing label column {e} for {clip_id}, skipping.")
                continue

            label_tensor = torch.tensor(label_values, dtype=torch.float32)
            samples.append((video_path, label_tensor))

        if missing_video:
            logger.warning(f"[{self.split}] {missing_video} clip(s) listed in manifest but not found on disk.")
        if missing_label:
            logger.warning(f"[{self.split}] {missing_label} clip(s) had no matching row in the label CSV.")

        return samples

    # ------------------------------------------------------------------ #
    # Video decoding
    # ------------------------------------------------------------------ #
    def _load_video(self, video_path: Path) -> torch.Tensor:
        """
        Decode `num_frames` uniformly sampled frames from a video file.

        Uses a single sequential pass over the video (rather than random
        seeks) because seeking is unreliable on many AVI/H.264 codecs.

        Returns:
            torch.FloatTensor of shape (C, T, H, W), values normalized to [0, 1].
        """
        cap = cv2.VideoCapture(str(video_path))
        if not cap.isOpened():
            raise IOError(f"OpenCV could not open video: {video_path}")

        try:
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            if total_frames <= 0:
                raise IOError(f"Video reports 0 frames (possibly corrupt): {video_path}")

            target_indices = np.linspace(0, total_frames - 1, self.num_frames).astype(int)
            wanted = set(target_indices.tolist())

            decoded: Dict[int, np.ndarray] = {}
            current_idx = 0
            max_wanted_idx = int(target_indices.max())

            while current_idx <= max_wanted_idx and len(decoded) < len(wanted):
                ret, frame = cap.read()
                if not ret:
                    break  # stream ended early / corrupt tail
                if current_idx in wanted:
                    frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                    frame = cv2.resize(
                        frame, (self.frame_size, self.frame_size), interpolation=cv2.INTER_AREA
                    )
                    decoded[current_idx] = frame
                current_idx += 1

            if not decoded:
                raise IOError(f"Failed to decode any frames from: {video_path}")

            # Fill any gaps (e.g. truncated video) by forward-filling the last
            # successfully decoded frame, so we always return exactly num_frames.
            frames: List[np.ndarray] = []
            last_valid = None
            for idx in target_indices:
                if idx in decoded:
                    last_valid = decoded[idx]
                if last_valid is None:
                    # No frame decoded yet -> use the first available one.
                    last_valid = next(iter(decoded.values()))
                frames.append(last_valid)

            frames_arr = np.stack(frames, axis=0).astype(np.float32) / 255.0  # (T, H, W, C)
            video_tensor = torch.from_numpy(frames_arr).permute(3, 0, 1, 2).contiguous()  # (C, T, H, W)
            return video_tensor

        finally:
            cap.release()

    # ------------------------------------------------------------------ #
    # Dataset protocol
    # ------------------------------------------------------------------ #
    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, torch.Tensor]:
        start_idx = idx
        for attempt in range(self.max_load_retries):
            video_path, label_tensor = self.samples[idx]
            try:
                video_tensor = self._load_video(video_path)
                return video_tensor, label_tensor
            except Exception as e:
                logger.warning(
                    f"[{self.split}] Skipping broken video "
                    f"'{video_path.name}' (attempt {attempt + 1}/{self.max_load_retries}): {e}"
                )
                idx = (idx + 1) % len(self.samples)

        raise RuntimeError(
            f"[{self.split}] Failed to load a valid video after {self.max_load_retries} "
            f"retries starting at index {start_idx}."
        )


# --------------------------------------------------------------------------- #
# Sanity check / smoke test
# --------------------------------------------------------------------------- #
if __name__ == "__main__":
    train_dataset = DAiSEEDataset(split="Train", root_dir=DEFAULT_ROOT)

    train_loader = DataLoader(
        train_dataset,
        batch_size=4,
        shuffle=True,
        num_workers=0,  # bump up on Linux; keep 0 on Windows unless guarded properly
        pin_memory=torch.cuda.is_available(),
    )

    videos, labels = next(iter(train_loader))

    print("=" * 60)
    print(f"Video batch shape : {tuple(videos.shape)}   (B, C, T, H, W)")
    print(f"Labels batch shape: {tuple(labels.shape)}   (B, 4)")
    print(f"Video dtype/range : {videos.dtype}, min={videos.min():.3f}, max={videos.max():.3f}")
    print(f"Sample labels[0]  : {labels[0].tolist()}  -> {LABEL_COLUMNS}")
    print("=" * 60)
