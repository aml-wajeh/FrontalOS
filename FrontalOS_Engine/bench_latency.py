"""
bench_latency.py

Measures model inference latency for one 16-frame 224x224 clip (the unit the
live engine scores about once a second), on GPU (if available) and CPU.

Reports p50 / p95 / mean in milliseconds after warm-up, plus the hardware it
ran on, and writes results/latency.json. Weights do not affect speed, so the
architecture is benchmarked without loading a checkpoint.

Usage:
    python bench_latency.py
    python bench_latency.py --gpu-runs 200 --cpu-runs 30
"""

from __future__ import annotations

import argparse
import json
import platform
import time
from pathlib import Path

import numpy as np
import torch

from train import NUM_LABELS, build_model

RESULTS = Path(__file__).resolve().parent / "results" / "latency.json"


def bench(model: torch.nn.Module, device: torch.device, runs: int, warmup: int) -> dict:
    model = model.to(device).eval()
    clip = torch.rand(1, 3, 16, 224, 224, device=device)
    timings = []
    with torch.no_grad(), torch.autocast(device_type=device.type, enabled=(device.type == "cuda")):
        for i in range(warmup + runs):
            if device.type == "cuda":
                torch.cuda.synchronize()
            start = time.perf_counter()
            model(clip)
            if device.type == "cuda":
                torch.cuda.synchronize()
            if i >= warmup:
                timings.append((time.perf_counter() - start) * 1000)
    t = np.array(timings)
    return {"runs": runs, "p50_ms": round(float(np.percentile(t, 50)), 1),
            "p95_ms": round(float(np.percentile(t, 95)), 1), "mean_ms": round(float(t.mean()), 1)}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--gpu-runs", type=int, default=200)
    parser.add_argument("--cpu-runs", type=int, default=30)
    args = parser.parse_args()

    model = build_model(NUM_LABELS, pretrained=False)
    params = sum(p.numel() for p in model.parameters())
    report: dict = {
        "model": "X3D-XS (v2 head)",
        "input": "1 x 3 x 16 x 224 x 224",
        "parameters": params,
        "torch": torch.__version__,
        "cpu": platform.processor() or platform.machine(),
        "results": {},
    }
    if torch.cuda.is_available():
        report["gpu"] = torch.cuda.get_device_name(0)
        report["results"]["cuda_fp16_autocast"] = bench(model, torch.device("cuda"), args.gpu_runs, warmup=20)
    torch.set_num_threads(max(1, torch.get_num_threads()))
    report["results"]["cpu_fp32"] = bench(model, torch.device("cpu"), args.cpu_runs, warmup=3)
    report["cpu_threads"] = torch.get_num_threads()

    RESULTS.parent.mkdir(exist_ok=True)
    RESULTS.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
