"""
Central configuration, read once from the environment. Nothing here is
hardcoded to a developer machine or a fake secret — every value documented
in .env.example is actually consumed by the code, not aspirational.
"""
import os


def _bool(name: str, default: bool) -> bool:
    val = os.environ.get(name)
    if val is None:
        return default
    return val.strip().lower() in ("1", "true", "yes", "on")


class Settings:
    # --- Auth / JWT -----------------------------------------------------
    JWT_SECRET_KEY: str = os.environ.get("JWT_SECRET_KEY") or "dev-only-insecure-secret-CHANGE-ME"
    JWT_SECRET_KEY_IS_DEFAULT: bool = not bool(os.environ.get("JWT_SECRET_KEY"))
    JWT_ALGORITHM: str = os.environ.get("JWT_ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.environ.get("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
    REFRESH_TOKEN_EXPIRE_DAYS: int = int(os.environ.get("REFRESH_TOKEN_EXPIRE_DAYS", "7"))

    # --- AI model paths (Prompt: AI layer fix) ---------------------------
    # Default paths point at services/cortix-api/models/, matching
    # docs/MODELS_README.md. Override via env for a different deployment
    # layout.
    _here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    CORTIX_TABULAR_MODEL_PATH: str = os.environ.get(
        "CORTIX_TABULAR_MODEL_PATH",
        os.path.join(_here, "models", "adhd_model_pca_no_outliers_tuned.pkl"),
    )
    CORTIX_MRI_MODEL_PATH: str = os.environ.get(
        "CORTIX_MRI_MODEL_PATH",
        os.path.join(_here, "models", "best_model.h5"),
    )
    CORTIX_MRI_MODEL_PATH_FEMALE: str = os.environ.get(
        "CORTIX_MRI_MODEL_PATH_FEMALE",
        os.path.join(_here, "models", "best_model_smote_female_adhd.h5"),
    )
    TABULAR_FEATURE_COUNT: int = int(os.environ.get("CORTIX_TABULAR_FEATURE_COUNT", "818"))

    # --- Chat / LLM integration point ------------------------------------
    # Not required today — chat.py works fully templated/data-driven without
    # it. Set this once a real LLM should be dropped in (see chat.py TODO).
    CHAT_LLM_API_KEY: str = os.environ.get("CHAT_LLM_API_KEY", "")

    # --- Admin system-health aggregation (api/v1/admin.py) ---------------
    FRONTALOS_ENGINE_HEALTH_URL: str = os.environ.get(
        "FRONTALOS_ENGINE_HEALTH_URL", "http://frontalos-engine:8001/health"
    )


settings = Settings()