"""
evaluate.py

Held-out evaluation of the trained X3D-XS model on the DAiSEE **Test** split,
which was never used for training or checkpoint selection.

Compares the model against two baselines that need no video at all:
    - mean predictor:     always predicts each label's mean from TrainLabels.csv
    - majority predictor: always predicts each label's most frequent level

If the model does not beat these, it has not learned anything useful from
the video. Results are written to results/ so the numbers in the README can
be reproduced and audited.

Usage:
    python evaluate.py                      # full test split
    python evaluate.py --limit 50           # quick smoke run
    DAISEE_ROOT=/path/to/DataSet python evaluate.py
"""

from __future__ import annotations

import argparse
import json
import os
import time
from pathlib import Path

import numpy as np
import pandas as pd
import torch
from torch.utils.data import DataLoader, Dataset

from dataset_loader import LABEL_COLUMNS, DAiSEEDataset, default_root
from metrics import bootstrap_ci, label_metrics
from train import DEVICE, NUM_LABELS, build_model

SAVE_PATH = Path(__file__).resolve().parent / "frontal_x3d_v2.pth"

RESULTS_DIR = Path(__file__).resolve().parent / "results"


class _IndexedClips(Dataset):
    """Wraps DAiSEEDataset so each item keeps its clip id; broken clips are
    returned as None and dropped (never silently swapped for another clip)."""

    def __init__(self, base: DAiSEEDataset, limit: int | None):
        self.base = base
        self.n = len(base.samples) if limit is None else min(limit, len(base.samples))

    def __len__(self) -> int:
        return self.n

    def __getitem__(self, idx: int):
        path, label = self.base.samples[idx]
        try:
            return self.base._load_video(path), label, path.name
        except Exception:  # noqa: BLE001 - counted and reported below
            return None


def _collate(batch):
    batch = [b for b in batch if b is not None]
    if not batch:
        return None
    videos, labels, names = zip(*batch)
    return torch.stack(videos), torch.stack(labels), list(names)


def run_model(root: Path, limit: int | None, batch_size: int, workers: int,
              weights: Path, legacy_v1: bool) -> pd.DataFrame:
    base = DAiSEEDataset(split="Test", root_dir=root)
    data = _IndexedClips(base, limit)
    loader = DataLoader(data, batch_size=batch_size, num_workers=workers, collate_fn=_collate)

    model = build_model(NUM_LABELS, legacy_v1=legacy_v1, pretrained=False)
    model.load_state_dict(torch.load(weights, map_location=DEVICE, weights_only=True))
    model.to(DEVICE).eval()

    rows = []
    start = time.time()
    with torch.no_grad():
        for i, batch in enumerate(loader):
            if batch is None:
                continue
            videos, labels, names = batch
            with torch.autocast(device_type=DEVICE.type, enabled=(DEVICE.type == "cuda")):
                preds = model(videos.to(DEVICE, non_blocking=True)).float().cpu().numpy()
            for name, y, p in zip(names, labels.numpy(), preds):
                rows.append({"ClipID": name, **{f"true_{c}": int(v) for c, v in zip(LABEL_COLUMNS, y)},
                             **{f"pred_{c}": float(v) for c, v in zip(LABEL_COLUMNS, p)}})
            if (i + 1) % 25 == 0:
                print(f"  {len(rows)}/{len(data)} clips  ({time.time() - start:.0f}s)", flush=True)

    skipped = len(data) - len(rows)
    print(f"Evaluated {len(rows)} clips, skipped {skipped} unreadable, in {time.time() - start:.0f}s")
    return pd.DataFrame(rows)


def evaluate(df: pd.DataFrame, root: Path) -> dict:
    train = pd.read_csv(root / "TrainLabels.csv")
    train.columns = [c.strip() for c in train.columns]

    report: dict = {"n_clips": int(len(df)), "labels": {}}
    for col in LABEL_COLUMNS:
        y = df[f"true_{col}"].to_numpy()
        pred = df[f"pred_{col}"].to_numpy()
        mean_value = float(train[col].mean())
        majority_value = float(train[col].mode().iloc[0])

        model_m = label_metrics(y, pred)
        model_m["mae_ci95"] = bootstrap_ci(y, pred, "mae")
        model_m["qwk_ci95"] = bootstrap_ci(y, pred, "qwk")

        report["labels"][col] = {
            "test_distribution": {int(k): int(v) for k, v in sorted(pd.Series(y).value_counts().items())},
            "model": model_m,
            "mean_baseline": {"value": mean_value, **label_metrics(y, np.full_like(pred, mean_value))},
            "majority_baseline": {"value": majority_value, **label_metrics(y, np.full_like(pred, majority_value))},
        }

    all_true = df[[f"true_{c}" for c in LABEL_COLUMNS]].to_numpy(float)
    all_pred = df[[f"pred_{c}" for c in LABEL_COLUMNS]].to_numpy(float)
    report["overall_mse"] = float(np.mean((all_pred - all_true) ** 2))
    return report


def write_markdown(report: dict, path: Path) -> None:
    lines = [
        "# DAiSEE Test-Split Results",
        "",
        f"Held-out test clips evaluated: **{report['n_clips']}**. "
        f"Overall MSE (all 4 labels): **{report['overall_mse']:.4f}**.",
        "",
        "Generated by `evaluate.py`. Levels are 0–3; ordinal metrics round the model output to the nearest level.",
        "",
    ]
    for col, r in report["labels"].items():
        m, mb, jb = r["model"], r["mean_baseline"], r["majority_baseline"]
        lines += [
            f"## {col}",
            "",
            f"Test label distribution (level: count): {r['test_distribution']}",
            "",
            "| Predictor | MAE | MSE | Accuracy | Macro-F1 | QWK |",
            "|---|---|---|---|---|---|",
            f"| **X3D-XS model** | {m['mae']:.3f} (95% CI {m['mae_ci95'][0]:.3f}–{m['mae_ci95'][1]:.3f}) "
            f"| {m['mse']:.3f} | {m['accuracy']:.3f} | {m['macro_f1']:.3f} "
            f"| {m['qwk']:.3f} (95% CI {m['qwk_ci95'][0]:.3f}–{m['qwk_ci95'][1]:.3f}) |",
            f"| Mean baseline ({mb['value']:.2f}) | {mb['mae']:.3f} | {mb['mse']:.3f} | {mb['accuracy']:.3f} "
            f"| {mb['macro_f1']:.3f} | {mb['qwk']:.3f} |",
            f"| Majority baseline ({jb['value']:.0f}) | {jb['mae']:.3f} | {jb['mse']:.3f} | {jb['accuracy']:.3f} "
            f"| {jb['macro_f1']:.3f} | {jb['qwk']:.3f} |",
            "",
        ]
    path.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--limit", type=int, default=None, help="evaluate only the first N clips")
    parser.add_argument("--batch-size", type=int, default=4)
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--from-csv", type=Path, default=None, help="recompute metrics from saved predictions")
    parser.add_argument("--weights", type=Path, default=SAVE_PATH, help="checkpoint to evaluate")
    parser.add_argument("--legacy-v1", action="store_true",
                        help="evaluate the original v1 network (softmax head, no input normalization)")
    parser.add_argument("--tag", default=None, help="suffix for result file names, e.g. v1 or v2")
    args = parser.parse_args()

    root = default_root()
    RESULTS_DIR.mkdir(exist_ok=True)
    suffix = "".join(f"_{s}" for s in (args.tag, None if args.limit is None else f"limit{args.limit}") if s)

    if args.from_csv:
        df = pd.read_csv(args.from_csv)
    else:
        print(f"Device: {DEVICE} | dataset root: {root} | weights: {args.weights} | legacy_v1: {args.legacy_v1}")
        df = run_model(root, args.limit, args.batch_size, args.workers, args.weights, args.legacy_v1)
        df.to_csv(RESULTS_DIR / f"test_predictions{suffix}.csv", index=False)

    report = evaluate(df, root)
    (RESULTS_DIR / f"test_metrics{suffix}.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    write_markdown(report, RESULTS_DIR / f"TEST_RESULTS{suffix}.md")
    print((RESULTS_DIR / f"TEST_RESULTS{suffix}.md").read_text(encoding="utf-8"))


if __name__ == "__main__":
    os.environ.setdefault("PYTHONUNBUFFERED", "1")
    main()
