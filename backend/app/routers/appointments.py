from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_roles
from app.db.database import get_db
from app.ml.categorization import categorize_reason
from app.ml.no_show_predictor import predict_no_show_probability, risk_level
from app.models.models import (
    Appointment, AppointmentStatus, Doctor, Notification, NotificationType, Patient, User, UserRole,
)
from app.schemas.schemas import (
    AppointmentCreate, AppointmentOut, AppointmentReschedule, AppointmentStatusUpdate,
    ConsultationNotesUpdate,
)

router = APIRouter(prefix="/appointments", tags=["appointments"])


def _estimate_no_show_risk(db: Session, patient: Patient, appt_date: date, appt_time) -> float:
    """Scheduling-risk estimate only (see AI disclaimer in schemas.py) —
    built from the patient's own appointment history plus the timing of
    the slot being booked. Computed BEFORE the new appointment is added
    to the session, so it never counts itself."""
    prior = db.query(Appointment).filter(Appointment.patient_id == patient.id).all()

    patient_age = 35  # reasonable default when date_of_birth hasn't been set
    if patient.date_of_birth:
        today = date.today()
        patient_age = today.year - patient.date_of_birth.year - (
            (today.month, today.day) < (patient.date_of_birth.month, patient.date_of_birth.day)
        )

    features = {
        "patient_age": patient_age,
        "previous_appointments": len(prior),
        "previous_no_shows": sum(1 for a in prior if a.status == AppointmentStatus.no_show),
        "previous_cancellations": sum(1 for a in prior if a.status == AppointmentStatus.cancelled),
        "lead_time_days": max((appt_date - date.today()).days, 0),
        "day_of_week": appt_date.weekday(),
        "appointment_hour": appt_time.hour,
    }
    return round(predict_no_show_probability(features), 4)


def _to_out(appt: Appointment) -> AppointmentOut:
    return AppointmentOut(
        id=appt.id,
        patient_id=appt.patient_id,
        patient_name=appt.patient.user.full_name if appt.patient else None,
        doctor_id=appt.doctor_id,
        doctor_name=appt.doctor.user.full_name if appt.doctor else None,
        appointment_date=appt.appointment_date,
        appointment_time=appt.appointment_time,
        status=appt.status,
        category=appt.category,
        reason=appt.reason,
        consultation_notes=appt.consultation_notes,
        no_show_risk_score=appt.no_show_risk_score,
        created_at=appt.created_at,
    )


def _get_appt_or_404(appointment_id: str, db: Session) -> Appointment:
    appt = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return appt


def _authorize(appt: Appointment, current_user: User):
    if current_user.role == UserRole.patient and appt.patient.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your appointment")
    if current_user.role == UserRole.doctor and appt.doctor.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your appointment")


@router.post("", response_model=AppointmentOut, status_code=201)
def book_appointment(
    payload: AppointmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.patient)),
):
    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient profile not found")

    doctor = db.query(Doctor).filter(Doctor.id == payload.doctor_id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")

    category, _confidence = categorize_reason(payload.reason or "")
    no_show_risk = _estimate_no_show_risk(db, patient, payload.appointment_date, payload.appointment_time)

    appt = Appointment(
        patient_id=patient.id,
        doctor_id=payload.doctor_id,
        appointment_date=payload.appointment_date,
        appointment_time=payload.appointment_time,
        reason=payload.reason,
        category=category,
        status=AppointmentStatus.scheduled,
        no_show_risk_score=no_show_risk,
    )
    db.add(appt)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="That time slot was just booked. Pick another slot.")

    db.add(Notification(
        user_id=doctor.user_id,
        type=NotificationType.appointment_booked,
        message=(
            f"New appointment booked by {current_user.full_name} on {payload.appointment_date} "
            f"at {payload.appointment_time} (no-show risk: {risk_level(no_show_risk)})."
        ),
    ))
    db.commit()
    db.refresh(appt)
    return _to_out(appt)


@router.get("", response_model=list[AppointmentOut])
def list_appointments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    status_filter: AppointmentStatus | None = None,
    on_date: date | None = None,
):
    query = db.query(Appointment)
    if current_user.role == UserRole.patient:
        patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
        query = query.filter(Appointment.patient_id == patient.id if patient else False)
    elif current_user.role == UserRole.doctor:
        doctor = db.query(Doctor).filter(Doctor.user_id == current_user.id).first()
        query = query.filter(Appointment.doctor_id == doctor.id if doctor else False)
    # admin sees all

    if status_filter:
        query = query.filter(Appointment.status == status_filter)
    if on_date:
        query = query.filter(Appointment.appointment_date == on_date)

    return [_to_out(a) for a in query.order_by(Appointment.appointment_date, Appointment.appointment_time).all()]


@router.get("/{appointment_id}", response_model=AppointmentOut)
def get_appointment(
    appointment_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    appt = _get_appt_or_404(appointment_id, db)
    _authorize(appt, current_user)
    return _to_out(appt)


@router.put("/{appointment_id}/reschedule", response_model=AppointmentOut)
def reschedule_appointment(
    appointment_id: str,
    payload: AppointmentReschedule,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.patient)),
):
    appt = _get_appt_or_404(appointment_id, db)
    _authorize(appt, current_user)
    if appt.status in (AppointmentStatus.completed, AppointmentStatus.cancelled):
        raise HTTPException(status_code=400, detail=f"Cannot reschedule a {appt.status.value} appointment")

    appt.appointment_date = payload.appointment_date
    appt.appointment_time = payload.appointment_time
    appt.status = AppointmentStatus.scheduled
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="That time slot is already booked.")
    db.refresh(appt)
    return _to_out(appt)


@router.put("/{appointment_id}/cancel", response_model=AppointmentOut)
def cancel_appointment(
    appointment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    appt = _get_appt_or_404(appointment_id, db)
    _authorize(appt, current_user)
    if appt.status == AppointmentStatus.completed:
        raise HTTPException(status_code=400, detail="Cannot cancel a completed appointment")
    appt.status = AppointmentStatus.cancelled
    db.commit()
    db.refresh(appt)
    return _to_out(appt)


@router.put("/{appointment_id}/status", response_model=AppointmentOut)
def update_status(
    appointment_id: str,
    payload: AppointmentStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.doctor, UserRole.admin)),
):
    appt = _get_appt_or_404(appointment_id, db)
    _authorize(appt, current_user)
    appt.status = payload.status
    db.add(Notification(
        user_id=appt.patient.user_id,
        type=NotificationType.appointment_status_change,
        message=f"Your appointment on {appt.appointment_date} is now {payload.status.value}.",
    ))
    db.commit()
    db.refresh(appt)
    return _to_out(appt)


@router.put("/{appointment_id}/notes", response_model=AppointmentOut)
def add_consultation_notes(
    appointment_id: str,
    payload: ConsultationNotesUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.doctor)),
):
    appt = _get_appt_or_404(appointment_id, db)
    _authorize(appt, current_user)
    appt.consultation_notes = payload.consultation_notes
    db.commit()
    db.refresh(appt)
    return _to_out(appt)
