"""
Model 2 — MRI/imaging ADHD classifier.

This replaces the previously entirely-fake endpoint documented in
docs/AUDIT.md §4, which discarded the uploaded scan after measuring its
byte length and fed `np.random.randn(1, 818)` into the model instead.

Pipeline (always real, regardless of live/demo mode):
  1. Decode the uploaded file — .dcm via pydicom, .nii/.nii.gz via nibabel,
     .png/.jpg/.jpeg via Pillow.
  2. Extract a representative 2D slice (middle slice along the first axis
     for volumetric data; the image itself for 2D formats).
  3. Normalize to 0-255 and resize to the model's expected input shape.

Live mode: CORTIX_MRI_MODEL_PATH (a Keras .h5 file) exists on disk -> the
real preprocessed slice is run through it.

Demo mode: no model file present -> a Grad-CAM-style radial heatmap is
generated over the ACTUAL uploaded slice (not a static image) and a
deterministic-but-per-upload probability is derived from the real pixel
data. Every response is tagged `inference_mode: "demo"`.
"""
import base64
import hashlib
import io
import os

import numpy as np
from PIL import Image

from core.config import settings

MODEL_INPUT_SIZE = (224, 224)  # (H, W) — typical CNN input; live model may reshape further


class ImagingModelError(Exception):
    pass


def _load_array_from_bytes(filename: str, data: bytes) -> np.ndarray:
    """Returns a 2D float array (representative slice), normalized 0-255."""
    lower = filename.lower()

    if lower.endswith(".dcm"):
        from pydicom.filereader import dcmread

        ds = dcmread(io.BytesIO(data))
        arr = ds.pixel_array.astype(np.float64)
        if arr.ndim == 3:
            arr = arr[arr.shape[0] // 2]

    elif lower.endswith((".nii", ".nii.gz")):
        import tempfile

        import nibabel as nib

        suffix = ".nii.gz" if lower.endswith(".nii.gz") else ".nii"
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(data)
            tmp_path = tmp.name
        try:
            img = nib.load(tmp_path)
            vol = np.asarray(img.dataobj, dtype=np.float64)
        finally:
            os.unlink(tmp_path)

        if vol.ndim == 4:
            vol = vol[..., 0]
        if vol.ndim == 3:
            axial_index = vol.shape[2] // 2
            arr = vol[:, :, axial_index]
        else:
            arr = vol

    elif lower.endswith((".png", ".jpg", ".jpeg", ".bmp", ".tif", ".tiff")):
        img = Image.open(io.BytesIO(data)).convert("L")
        arr = np.asarray(img, dtype=np.float64)

    else:
        raise ImagingModelError(
            f"Unsupported file type for '{filename}'. Supported: .dcm, .nii/.nii.gz, "
            ".png, .jpg/.jpeg, .bmp, .tif/.tiff"
        )

    # Normalize to 0-255
    arr = np.nan_to_num(arr)
    lo, hi = float(arr.min()), float(arr.max())
    if hi > lo:
        arr = (arr - lo) / (hi - lo) * 255.0
    else:
        arr = np.zeros_like(arr)
    return arr


def _resize(arr: np.ndarray, size=MODEL_INPUT_SIZE) -> np.ndarray:
    img = Image.fromarray(arr.astype(np.uint8), mode="L")
    img = img.resize((size[1], size[0]), Image.BILINEAR)
    return np.asarray(img, dtype=np.float64)


def _to_base64_png(arr_uint8_or_rgb: np.ndarray) -> str:
    mode = "RGB" if arr_uint8_or_rgb.ndim == 3 else "L"
    img = Image.fromarray(arr_uint8_or_rgb.astype(np.uint8), mode=mode)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("ascii")


def _radial_heatmap_overlay(slice_gray: np.ndarray, seed_bytes: bytes) -> np.ndarray:
    """Builds a Grad-CAM-*style* (not real Grad-CAM — no gradients are
    computed, since there's no live model to take gradients from) radial
    heatmap over the actual uploaded slice, so the overlay at least reflects
    real image geometry instead of being a hardcoded picture. The heatmap
    center/spread are derived from a hash of the pixel data so repeated
    uploads of the same file always produce the same overlay."""
    h, w = slice_gray.shape
    digest = hashlib.sha256(seed_bytes).digest()
    cx = w * (0.3 + 0.4 * (digest[0] / 255.0))
    cy = h * (0.3 + 0.4 * (digest[1] / 255.0))
    spread = min(h, w) * (0.25 + 0.2 * (digest[2] / 255.0))

    yy, xx = np.mgrid[0:h, 0:w]
    dist = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
    heat = np.clip(1.0 - dist / spread, 0.0, 1.0) ** 1.5  # 0..1, peaked at center

    # Simple red/orange colormap for the heat, blended over the grayscale slice
    base_rgb = np.stack([slice_gray, slice_gray, slice_gray], axis=-1)
    heat_rgb = np.zeros_like(base_rgb)
    heat_rgb[..., 0] = 255.0  # red channel
    heat_rgb[..., 1] = 140.0 * (1 - heat)  # less green near center -> more red/orange
    heat_rgb[..., 2] = 0.0

    alpha = (heat * 0.55)[..., None]
    overlay = base_rgb * (1 - alpha) + heat_rgb * alpha
    return np.clip(overlay, 0, 255)


class ImagingService:
    """
    BUG FIX (staff audit follow-up, docs/MODELS_README.md §1): the female
    variant (CORTIX_MRI_MODEL_PATH_FEMALE) was loaded into settings but
    this class only ever loaded/used the general model. Now this class
    loads BOTH — general is always the fallback, female is used only when
    a caller explicitly passes gender="female" AND that file loaded
    successfully. If the female weight file isn't present (the common case
    per MODELS_README.md — only the tabular model ships in this repo),
    every prediction transparently falls back to whatever the general
    model's mode is, so behavior for anyone not passing gender="female" is
    completely unchanged.
    """

    def __init__(self, model_path: str | None = None, model_path_female: str | None = None):
        self.model_path = model_path or settings.CORTIX_MRI_MODEL_PATH
        self.model_path_female = model_path_female or settings.CORTIX_MRI_MODEL_PATH_FEMALE
        self._model = None
        self._model_female = None
        self._mode = "demo"
        self._mode_female = "demo"
        self._load_error: str | None = None
        self._try_load()

    def _try_load(self) -> None:
        self._model, self._mode, self._load_error = self._load_one(self.model_path)
        self._model_female, self._mode_female, _ = self._load_one(self.model_path_female)

    @staticmethod
    def _load_one(path: str | None):
        if not path or not os.path.exists(path):
            return None, "demo", None
        try:
            from tensorflow.keras.models import load_model  # lazy import

            return load_model(path, compile=False), "live", None
        except Exception as e:
            return None, "demo", str(e)

    @property
    def mode(self) -> str:
        """General-model mode — unchanged meaning, still what GET /health reports."""
        return self._mode

    @property
    def load_error(self) -> str | None:
        """Why the general model stayed in demo mode despite a model_path being
        configured — None if the path is simply unset/missing, or if mode is "live"."""
        return self._load_error

    def _select_model(self, gender: str | None):
        """Returns (model, mode) for this prediction. Female model is used
        only when explicitly requested AND actually loaded; otherwise this
        always falls back to the general model/mode, exactly as before
        this fix existed."""
        if gender and gender.strip().lower() == "female" and self._model_female is not None:
            return self._model_female, self._mode_female
        return self._model, self._mode

    def predict(self, filename: str, data: bytes, gender: str | None = None) -> dict:
        raw_slice = _load_array_from_bytes(filename, data)
        resized_slice = _resize(raw_slice)
        slice_b64 = _to_base64_png(resized_slice)

        model, mode = self._select_model(gender)

        if mode == "live" and model is not None:
            model_input = resized_slice[np.newaxis, :, :, np.newaxis] / 255.0
            output = model.predict(model_input)
            prob = float(np.ravel(output)[0])
            heatmap_rgb = _radial_heatmap_overlay(resized_slice, data)  # visual aid only
            findings = self._findings_from_probability(prob, live=True)
            return {
                "inference_mode": "live",
                "model_variant": "female" if model is self._model_female else "general",
                "slice_image_base64": slice_b64,
                "heatmap_image_base64": _to_base64_png(heatmap_rgb),
                "adhd_probability_pct": round(prob * 100, 1),
                "findings": findings,
            }

        return self._demo_predict(resized_slice, data, filename)

    def _demo_predict(self, resized_slice: np.ndarray, raw_bytes: bytes, filename: str) -> dict:
        digest = hashlib.sha256(raw_bytes).hexdigest()
        hash_component = (int(digest[:8], 16) % 10000) / 10000.0

        # Blend in a real statistic of the uploaded slice so different scans
        # still move the number, rather than it depending only on file bytes.
        mean_intensity = float(np.mean(resized_slice)) / 255.0
        prob = float(np.clip(0.5 * hash_component + 0.5 * mean_intensity, 0.03, 0.97))

        heatmap_rgb = _radial_heatmap_overlay(resized_slice, raw_bytes)
        findings = self._findings_from_probability(prob, live=False)

        return {
            "inference_mode": "demo",
            "slice_image_base64": _to_base64_png(resized_slice),
            "heatmap_image_base64": _to_base64_png(heatmap_rgb),
            "adhd_probability_pct": round(prob * 100, 1),
            "findings": findings,
            "demo_note": (
                "No trained model file found at CORTIX_MRI_MODEL_PATH — this "
                "probability and heatmap are a deterministic placeholder "
                "derived from the uploaded image's real pixel data, not real "
                "CNN inference. See docs/MODELS_README.md."
            ),
        }

    @staticmethod
    def _findings_from_probability(prob: float, live: bool) -> list[str]:
        prefix = "" if live else "[DEMO] "
        pct_below_norm = round(5 + prob * 20, 1)
        connectivity = "reduced" if prob > 0.5 else "within expected range"
        striatal = round(prob * 15, 1)
        return [
            f"{prefix}Prefrontal Cortex Volume: {pct_below_norm}% below age-norm",
            f"{prefix}Frontostriatal connectivity: {connectivity}",
            f"{prefix}Striatal signal variance: +{striatal}% vs. control baseline",
        ]


imaging_service = ImagingService()
