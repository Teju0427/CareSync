"""
Reusable FastAPI dependencies: current authenticated user, and
role-based access control guards.
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.database import get_db
from app.models.models import User, UserRole

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception
    user_id = payload.get("sub")
    if user_id is None:
        raise credentials_exception
    user = db.query(User).filter(User.id == user_id).first()
    if user is None or not user.is_active:
        raise credentials_exception
    return user


def require_roles(*roles: UserRole):
    """Dependency factory: restrict an endpoint to specific roles."""

    def checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to perform this action",
            )
        return current_user

    return checker


def doctor_has_treated_patient(db: Session, doctor_user_id: str, patient_id: str) -> bool:
    """True if this doctor has (or has had) at least one appointment with
    this patient. Used to gate doctor access to a patient's profile,
    medical records, and prescriptions — a doctor should only be able to
    pull up a patient's chart if there's an actual treatment
    relationship, not just because they know the patient's ID."""
    from app.models.models import Appointment, Doctor  # local import avoids a circular import at module load

    return (
        db.query(Appointment)
        .join(Doctor, Appointment.doctor_id == Doctor.id)
        .filter(Doctor.user_id == doctor_user_id, Appointment.patient_id == patient_id)
        .first()
        is not None
    )
