from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import doctor_has_treated_patient, get_current_user, require_roles
from app.db.database import get_db
from app.models.models import (
    Appointment, Doctor, Notification, NotificationType, Prescription, PrescriptionItem, User, UserRole,
)
from app.schemas.schemas import PrescriptionCreate, PrescriptionOut

router = APIRouter(prefix="/prescriptions", tags=["prescriptions"])


@router.post("", response_model=PrescriptionOut, status_code=201)
def create_prescription(
    payload: PrescriptionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.doctor)),
):
    appt = db.query(Appointment).filter(Appointment.id == payload.appointment_id).first()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    if appt.doctor.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your appointment")

    prescription = Prescription(
        appointment_id=appt.id,
        doctor_id=appt.doctor_id,
        patient_id=appt.patient_id,
        notes=payload.notes,
    )
    db.add(prescription)
    db.flush()

    for item in payload.items:
        db.add(PrescriptionItem(prescription_id=prescription.id, **item.model_dump()))

    db.add(Notification(
        user_id=appt.patient.user_id,
        type=NotificationType.prescription_added,
        message=f"A new prescription was added for your {appt.appointment_date} appointment.",
    ))

    db.commit()
    db.refresh(prescription)
    return prescription


@router.get("/patient/{patient_id}", response_model=list[PrescriptionOut])
def get_prescriptions_for_patient(
    patient_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == UserRole.patient:
        from app.models.models import Patient
        patient = db.query(Patient).filter(Patient.id == patient_id).first()
        if not patient or patient.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="You can only view your own prescriptions")
    if current_user.role == UserRole.doctor and not doctor_has_treated_patient(db, current_user.id, patient_id):
        raise HTTPException(
            status_code=403,
            detail="You can only view patients who have an appointment with you",
        )

    return db.query(Prescription).filter(Prescription.patient_id == patient_id).all()
