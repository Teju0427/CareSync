from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.deps import require_roles
from app.core.security import hash_password
from app.db.database import get_db
from app.models.models import (
    Appointment, AppointmentStatus, Department, Doctor, Patient, User, UserRole,
)
from app.schemas.schemas import AdminDashboardOut, DepartmentCreate, DepartmentOut, DoctorCreate, DoctorOut

router = APIRouter(prefix="/admin", tags=["admin"])
admin_only = require_roles(UserRole.admin)


# --- Departments -------------------------------------------------------------
@router.post("/departments", response_model=DepartmentOut, dependencies=[Depends(admin_only)])
def create_department(payload: DepartmentCreate, db: Session = Depends(get_db)):
    if db.query(Department).filter(Department.name == payload.name).first():
        raise HTTPException(status_code=400, detail="Department already exists")
    dept = Department(**payload.model_dump())
    db.add(dept)
    db.commit()
    db.refresh(dept)
    return dept


@router.get("/departments", response_model=list[DepartmentOut])
def list_departments(db: Session = Depends(get_db)):
    return db.query(Department).all()


@router.delete("/departments/{department_id}", status_code=204, dependencies=[Depends(admin_only)])
def delete_department(department_id: int, db: Session = Depends(get_db)):
    dept = db.query(Department).filter(Department.id == department_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    db.delete(dept)
    db.commit()


# --- Doctor provisioning ------------------------------------------------------
@router.post("/doctors", response_model=DoctorOut, status_code=201, dependencies=[Depends(admin_only)])
def create_doctor(payload: DoctorCreate, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    if db.query(Doctor).filter(Doctor.license_number == payload.license_number).first():
        raise HTTPException(status_code=400, detail="License number already in use")

    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        phone=payload.phone,
        role=UserRole.doctor,
    )
    db.add(user)
    db.flush()

    doctor = Doctor(
        user_id=user.id,
        department_id=payload.department_id,
        specialization=payload.specialization,
        license_number=payload.license_number,
        years_experience=payload.years_experience,
        consultation_fee=payload.consultation_fee,
        bio=payload.bio,
    )
    db.add(doctor)
    db.commit()
    db.refresh(doctor)

    return DoctorOut(
        id=doctor.id, full_name=user.full_name, email=user.email, department_id=doctor.department_id,
        department_name=doctor.department.name if doctor.department else None,
        specialization=doctor.specialization, license_number=doctor.license_number,
        years_experience=doctor.years_experience, consultation_fee=doctor.consultation_fee, bio=doctor.bio,
    )


@router.delete("/doctors/{doctor_id}", status_code=204, dependencies=[Depends(admin_only)])
def delete_doctor(doctor_id: str, db: Session = Depends(get_db)):
    doctor = db.query(Doctor).filter(Doctor.id == doctor_id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    user = db.query(User).filter(User.id == doctor.user_id).first()
    db.delete(doctor)
    if user:
        db.delete(user)
    db.commit()


# --- Dashboard -----------------------------------------------------------------
@router.get("/dashboard", response_model=AdminDashboardOut, dependencies=[Depends(admin_only)])
def dashboard(db: Session = Depends(get_db)):
    today = date.today()

    total_patients = db.query(func.count(Patient.id)).scalar() or 0
    total_doctors = db.query(func.count(Doctor.id)).scalar() or 0
    todays_appointments = (
        db.query(func.count(Appointment.id)).filter(Appointment.appointment_date == today).scalar() or 0
    )
    completed = (
        db.query(func.count(Appointment.id)).filter(Appointment.status == AppointmentStatus.completed).scalar() or 0
    )
    cancelled = (
        db.query(func.count(Appointment.id)).filter(Appointment.status == AppointmentStatus.cancelled).scalar() or 0
    )
    no_show = (
        db.query(func.count(Appointment.id)).filter(Appointment.status == AppointmentStatus.no_show).scalar() or 0
    )

    dept_stats = (
        db.query(Department.name, func.count(Appointment.id))
        .join(Doctor, Doctor.department_id == Department.id)
        .join(Appointment, Appointment.doctor_id == Doctor.id)
        .group_by(Department.name)
        .all()
    )
    department_stats = [{"department": name, "appointment_count": count} for name, count in dept_stats]

    since = today - timedelta(days=13)
    trend_rows = (
        db.query(Appointment.appointment_date, func.count(Appointment.id))
        .filter(Appointment.appointment_date >= since)
        .group_by(Appointment.appointment_date)
        .order_by(Appointment.appointment_date)
        .all()
    )
    appointment_trend = [{"date": str(d), "count": c} for d, c in trend_rows]

    return AdminDashboardOut(
        total_patients=total_patients,
        total_doctors=total_doctors,
        todays_appointments=todays_appointments,
        completed_appointments=completed,
        cancelled_appointments=cancelled,
        no_show_appointments=no_show,
        department_stats=department_stats,
        appointment_trend=appointment_trend,
    )
