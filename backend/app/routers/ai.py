from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.deps import require_roles
from app.db.database import get_db
from app.ml.categorization import categorize_reason
from app.ml.no_show_predictor import predict_no_show_probability, risk_level
from app.models.models import Appointment, Doctor, User, UserRole
from app.schemas.schemas import (
    CategorizationRequest, CategorizationResponse, NoShowPredictionRequest, NoShowPredictionResponse,
)

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/no-show-prediction", response_model=NoShowPredictionResponse)
def predict_no_show(
    payload: NoShowPredictionRequest,
    current_user: User = Depends(require_roles(UserRole.doctor, UserRole.admin)),
):
    probability = predict_no_show_probability(payload.model_dump())
    return NoShowPredictionResponse(
        no_show_probability=round(probability, 4),
        risk_level=risk_level(probability),
    )


@router.post("/categorize", response_model=CategorizationResponse)
def categorize(
    payload: CategorizationRequest,
    current_user: User = Depends(require_roles(UserRole.doctor, UserRole.admin, UserRole.patient)),
):
    category, confidence = categorize_reason(payload.reason)
    return CategorizationResponse(category=category, confidence=confidence)


@router.get("/scheduling-insights")
def scheduling_insights(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.admin, UserRole.doctor)),
):
    """Peak hours, busiest departments, cancellation/no-show trends, doctor utilization."""
    since = date.today() - timedelta(days=90)

    peak_hours = (
        db.query(Appointment.appointment_time, func.count(Appointment.id))
        .filter(Appointment.appointment_date >= since)
        .group_by(Appointment.appointment_time)
        .order_by(func.count(Appointment.id).desc())
        .limit(5)
        .all()
    )

    busiest_departments = (
        db.query(Doctor.department_id, func.count(Appointment.id))
        .join(Appointment, Appointment.doctor_id == Doctor.id)
        .filter(Appointment.appointment_date >= since)
        .group_by(Doctor.department_id)
        .order_by(func.count(Appointment.id).desc())
        .limit(5)
        .all()
    )

    total = db.query(func.count(Appointment.id)).filter(Appointment.appointment_date >= since).scalar() or 0
    cancelled = (
        db.query(func.count(Appointment.id))
        .filter(Appointment.appointment_date >= since, Appointment.status == "cancelled")
        .scalar() or 0
    )
    no_show = (
        db.query(func.count(Appointment.id))
        .filter(Appointment.appointment_date >= since, Appointment.status == "no_show")
        .scalar() or 0
    )

    doctor_utilization = (
        db.query(Doctor.id, func.count(Appointment.id))
        .join(Appointment, Appointment.doctor_id == Doctor.id)
        .filter(Appointment.appointment_date >= since)
        .group_by(Doctor.id)
        .order_by(func.count(Appointment.id).desc())
        .all()
    )

    return {
        "window_days": 90,
        "peak_hours": [{"hour": str(h), "count": c} for h, c in peak_hours],
        "busiest_departments": [{"department_id": d, "count": c} for d, c in busiest_departments],
        "cancellation_rate": round(cancelled / total, 4) if total else 0,
        "no_show_rate": round(no_show / total, 4) if total else 0,
        "doctor_utilization": [{"doctor_id": d, "appointment_count": c} for d, c in doctor_utilization],
    }
