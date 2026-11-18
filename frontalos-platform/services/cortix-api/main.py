from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from auth.router import router as auth_router
from api.v1.ai import router as ai_router
from api.v1.analytics import router as analytics_router
from api.v1.reports import router as reports_router
from api.v1.chat import router as chat_router
from api.v1.patients import router as patients_router
from api.v1.games import router as games_router
from api.v1.checkins import router as checkins_router
from api.v1.notifications import router as notifications_router
from api.v1.rewards import router as rewards_router
from api.v1.admin import router as admin_router
from database.session import init_db, USING_SQLITE_FALLBACK
from core.config import settings

app = FastAPI(
    title="CORTIX AI-Powered ADHD Clinical Decision Support Platform API",
    version="2.0.0",
    description=(
        "Backend API integrating the WiDS/HBN tabular model and ADHD-200 CNN "
        "models. Every AI response is tagged inference_mode: 'live' or "
        "'demo' — see docs/MODELS_README.md for how to activate live mode."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(ai_router, prefix="/api/v1")
app.include_router(analytics_router, prefix="/api/v1")
app.include_router(reports_router, prefix="/api/v1")
app.include_router(chat_router, prefix="/api/v1")
app.include_router(patients_router, prefix="/api/v1")
app.include_router(games_router, prefix="/api/v1")
app.include_router(checkins_router, prefix="/api/v1")
app.include_router(notifications_router, prefix="/api/v1")
app.include_router(rewards_router, prefix="/api/v1")
# BUG FIX (staff audit follow-up): api/v1/admin.py was fully written
# (users list/deactivate/role-change, audit log viewer, system health) but
# never actually mounted here, so none of its routes were reachable and
# core/security.py::require_role("admin") had no caller in the whole app.
app.include_router(admin_router, prefix="/api/v1")


@app.on_event("startup")
def on_startup():
    init_db()


@app.get("/health")
def health_check():
    from core.ai.tabular_service import tabular_service
    from core.ai.imaging_service import imaging_service

    return {
        "status": "healthy",
        "platform": "CORTIX AI Clinical Decision Support",
        "database": "sqlite-fallback" if USING_SQLITE_FALLBACK else "configured",
        "ai_models": {
            "tabular": tabular_service.mode,
            "imaging": imaging_service.mode,
        },
        # Populated only when a model file is present but failed to load (so
        # "demo" is never a silent mystery — e.g. a missing custom class the
        # pickle depends on, a corrupt file, or a version mismatch). None
        # when the mode is "live", or when the path is simply unset/missing.
        "ai_model_load_errors": {
            "tabular": tabular_service.load_error,
            "imaging": imaging_service.load_error,
        },
        "jwt_secret_is_default": settings.JWT_SECRET_KEY_IS_DEFAULT,
    }
