from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_roles
from app.db.database import get_db
from app.models.models import Appointment, Doctor, DoctorAvailability, User, UserRole
from app.schemas.schemas import (
    AvailabilityCreate, AvailabilityOut, AvailableSlotOut, DoctorOut, DoctorUpdate,
)

router = APIRouter(prefix="/doctors", tags=["doctors"])


def _to_doctor_out(doctor: Doctor) -> DoctorOut:
    return DoctorOut(
        id=doctor.id,
        full_name=doctor.user.full_name,
        email=doctor.user.email,
        department_id=doctor.department_id,
        department_name=doctor.department.name if doctor.department else None,
        specialization=doctor.specialization,
        license_number=doctor.license_number,
        years_experience=doctor.years_experience,
        consultation_fee=doctor.consultation_fee,
        bio=doctor.bio,
    )


@router.get("", response_model=list[DoctorOut])
def list_doctors(
    department_id: int | None = None,
    specialization: str | None = None,
    search: str | None = Query(None, description="Search by doctor name"),
    db: Session = Depends(get_db),
):
    query = db.query(Doctor)
    if department_id:
        query = query.filter(Doctor.department_id == department_id)
    if specialization:
        query = query.filter(Doctor.specialization.ilike(f"%{specialization}%"))
    doctors = query.all()
    if search:
        doctors = [d for d in doctors if search.lower() in d.user.full_name.lower()]
    return [_to_doctor_out(d) for d in doctors]


@router.get("/me", response_model=DoctorOut)
def get_my_doctor_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.doctor)),
):
    doctor = db.query(Doctor).filter(Doctor.user_id == current_user.id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor profile not found")
    return _to_doctor_out(doctor)


@router.get("/{doctor_id}", response_model=DoctorOut)
def get_doctor(doctor_id: str, db: Session = Depends(get_db)):
    doctor = db.query(Doctor).filter(Doctor.id == doctor_id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    return _to_doctor_out(doctor)


@router.put("/{doctor_id}", response_model=DoctorOut)
def update_doctor(
    doctor_id: str,
    payload: DoctorUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.admin, UserRole.doctor)),
):
    doctor = db.query(Doctor).filter(Doctor.id == doctor_id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    if current_user.role == UserRole.doctor and doctor.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only edit your own profile")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(doctor, field, value)
    db.commit()
    db.refresh(doctor)
    return _to_doctor_out(doctor)


# --- Availability -----------------------------------------------------------
@router.post("/{doctor_id}/availability", response_model=AvailabilityOut)
def set_availability(
    doctor_id: str,
    payload: AvailabilityCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.doctor, UserRole.admin)),
):
    doctor = db.query(Doctor).filter(Doctor.id == doctor_id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    if current_user.role == UserRole.doctor and doctor.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only set your own availability")

    slot = DoctorAvailability(doctor_id=doctor_id, **payload.model_dump())
    db.add(slot)
    db.commit()
    db.refresh(slot)
    return slot


@router.get("/{doctor_id}/availability", response_model=list[AvailabilityOut])
def get_availability(doctor_id: str, db: Session = Depends(get_db)):
    return (
        db.query(DoctorAvailability)
        .filter(DoctorAvailability.doctor_id == doctor_id, DoctorAvailability.is_active.is_(True))
        .all()
    )


@router.delete("/{doctor_id}/availability/{availability_id}", status_code=204)
def delete_availability(
    doctor_id: str,
    availability_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.doctor, UserRole.admin)),
):
    doctor = db.query(Doctor).filter(Doctor.id == doctor_id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    if current_user.role == UserRole.doctor and doctor.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only manage your own availability")

    slot = (
        db.query(DoctorAvailability)
        .filter(DoctorAvailability.id == availability_id, DoctorAvailability.doctor_id == doctor_id)
        .first()
    )
    if not slot:
        raise HTTPException(status_code=404, detail="Availability block not found")

    db.delete(slot)
    db.commit()


@router.get("/{doctor_id}/available-slots", response_model=list[AvailableSlotOut])
def get_available_slots(
    doctor_id: str,
    for_date: date = Query(..., description="Date to check available slots for"),
    db: Session = Depends(get_db),
):
    """Compute open time slots for a given date from the doctor's weekly availability,
    minus slots already booked (any status other than cancelled/no_show)."""
    doctor = db.query(Doctor).filter(Doctor.id == doctor_id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")

    day_of_week = for_date.weekday()  # Monday=0
    availability = (
        db.query(DoctorAvailability)
        .filter(
            DoctorAvailability.doctor_id == doctor_id,
            DoctorAvailability.day_of_week == day_of_week,
            DoctorAvailability.is_active.is_(True),
        )
        .all()
    )
    if not availability:
        return []

    booked_times = {
        a.appointment_time
        for a in db.query(Appointment).filter(
            Appointment.doctor_id == doctor_id,
            Appointment.appointment_date == for_date,
            Appointment.status.notin_(["cancelled", "no_show"]),
        )
    }

    slots: list[AvailableSlotOut] = []
    for block in availability:
        current = datetime.combine(for_date, block.start_time)
        end = datetime.combine(for_date, block.end_time)
        step = timedelta(minutes=block.slot_duration_minutes)
        while current < end:
            if current.time() not in booked_times:
                slots.append(AvailableSlotOut(date=for_date, time=current.time()))
            current += step
    return slots
