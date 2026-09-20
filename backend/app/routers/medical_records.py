from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import doctor_has_treated_patient, get_current_user, require_roles
from app.db.database import get_db
from app.models.models import MedicalRecord, Patient, User, UserRole
from app.schemas.schemas import MedicalRecordCreate, MedicalRecordOut

router = APIRouter(prefix="/medical-records", tags=["medical-records"])


@router.post("", response_model=MedicalRecordOut, status_code=201)
def create_record(
    payload: MedicalRecordCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.doctor, UserRole.admin)),
):
    if current_user.role == UserRole.doctor and not doctor_has_treated_patient(
        db, current_user.id, payload.patient_id
    ):
        raise HTTPException(
            status_code=403,
            detail="You can only add records for patients who have an appointment with you",
        )
    record = MedicalRecord(**payload.model_dump(), created_by=current_user.id)
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.get("/{patient_id}", response_model=list[MedicalRecordOut])
def get_records_for_patient(
    patient_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    if current_user.role == UserRole.patient and patient.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only view your own records")
    if current_user.role == UserRole.doctor and not doctor_has_treated_patient(db, current_user.id, patient_id):
        raise HTTPException(
            status_code=403,
            detail="You can only view patients who have an appointment with you",
        )

    return (
        db.query(MedicalRecord)
        .filter(MedicalRecord.patient_id == patient_id)
        .order_by(MedicalRecord.created_at.desc())
        .all()
    )
