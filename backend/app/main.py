"""
CareSync API — entrypoint.

Mounts all routers, configures CORS, and creates tables on startup for
local/demo convenience (production deployments should use Alembic
migrations instead — see database/schema.sql and the docs/ folder).
"""
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.db.database import Base, engine
from app.models import models  # noqa: F401 — ensures models are registered before create_all
from app.routers import admin, ai, appointments, auth, doctors, medical_records, notifications, patients, prescriptions

app = FastAPI(
    title=settings.APP_NAME,
    description=(
        "CareSync — administrative medical appointment and patient management API. "
        "Not a diagnostic system: AI features assist scheduling/operations only."
    ),
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    if settings.ENV == "production" and settings.JWT_SECRET_KEY == "change-me-in-production":
        raise RuntimeError("Refusing to start in production with the default JWT_SECRET_KEY. Set a long random value.")
    Base.metadata.create_all(bind=engine)
    if settings.SEED_DEMO_DATA:
        try:
            from seed_demo_data import main as seed_main
            seed_main()
        except Exception as exc:  # seeding is a convenience; never block the API from starting
            logging.getLogger("caresync").exception("Demo seeding failed: %s", exc)


@app.get("/health", tags=["health"])
def health_check():
    return {"status": "ok", "service": settings.APP_NAME}


app.include_router(auth.router)
app.include_router(patients.router)
app.include_router(doctors.router)
app.include_router(appointments.router)
app.include_router(medical_records.router)
app.include_router(prescriptions.router)
app.include_router(notifications.router)
app.include_router(admin.router)
app.include_router(ai.router)
