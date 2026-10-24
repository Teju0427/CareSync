from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import doctor_has_treated_patient, get_current_user, require_roles
from app.models.models import MedicalRecord, Patient, User, UserRole
from app.schemas.schemas import MedicalRecordOut, PatientOut, PatientProfileUpdate
from app.db.database import get_db

router = APIRouter(prefix="/patients", tags=["patients"])


def _to_patient_out(patient: Patient) -> PatientOut:
    return PatientOut(
        id=patient.id,
        user_id=patient.user_id,
        full_name=patient.user.full_name,
        email=patient.user.email,
        date_of_birth=patient.date_of_birth,
        gender=patient.gender,
        blood_group=patient.blood_group,
        address=patient.address,
        emergency_contact=patient.emergency_contact,
    )


def _get_patient_or_404(patient_id: str, db: Session) -> Patient:
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient


def _authorize_patient_access(patient: Patient, current_user: User):
    if current_user.role == UserRole.patient and patient.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only access your own records")


def _authorize_patient_read(patient: Patient, current_user: User, db: Session):
    """Stricter than _authorize_patient_access: a doctor can only read a
    patient's chart if they've actually treated them (have at least one
    appointment together), not just because they know the patient's ID."""
    _authorize_patient_access(patient, current_user)
    if current_user.role == UserRole.doctor and not doctor_has_treated_patient(db, current_user.id, patient.id):
        raise HTTPException(
            status_code=403,
            detail="You can only view patients who have an appointment with you",
        )


@router.get("/me", response_model=PatientOut)
def get_my_patient_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.patient)),
):
    """Resolve the logged-in patient's own profile — doesn't depend on
    having any appointments yet, unlike deriving patient_id from
    appointment history."""
    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient profile not found")
    return _to_patient_out(patient)


@router.get("/{patient_id}", response_model=PatientOut)
def get_patient(
    patient_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    patient = _get_patient_or_404(patient_id, db)
    _authorize_patient_read(patient, current_user, db)
    return _to_patient_out(patient)


@router.put("/{patient_id}", response_model=PatientOut)
def update_patient_profile(
    patient_id: str,
    payload: PatientProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    patient = _get_patient_or_404(patient_id, db)
    _authorize_patient_access(patient, current_user)

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(patient, field, value)
    db.commit()
    db.refresh(patient)
    return _to_patient_out(patient)


@router.get("", response_model=list[PatientOut])
def list_patients(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.admin)),
):
    return [_to_patient_out(p) for p in db.query(Patient).order_by(Patient.created_at.desc()).all()]
