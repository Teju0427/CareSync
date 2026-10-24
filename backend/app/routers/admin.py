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

    def count(*filters):
        return db.query(func.count(Appointment.id)).filter(*filters).scalar() or 0

    total_patients = db.query(func.count(Patient.id)).scalar() or 0
    total_doctors = db.query(func.count(Doctor.id)).scalar() or 0
    total_appointments = count()
    todays_appointments = count(Appointment.appointment_date == today)
    completed = count(Appointment.status == AppointmentStatus.completed)
    cancelled = count(Appointment.status == AppointmentStatus.cancelled)
    no_show = count(Appointment.status == AppointmentStatus.no_show)
    upcoming = count(
        Appointment.appointment_date >= today,
        Appointment.status.in_([AppointmentStatus.scheduled, AppointmentStatus.confirmed]),
    )
    # No-show rate among visits that actually reached an outcome
    resolved = completed + no_show
    no_show_rate = round(no_show / resolved, 4) if resolved else 0.0

    status_rows = (
        db.query(Appointment.status, func.count(Appointment.id)).group_by(Appointment.status).all()
    )
    status_breakdown = [{"status": s.value, "count": c} for s, c in status_rows]

    dept_stats = (
        db.query(Department.name, func.count(Appointment.id))
        .join(Doctor, Doctor.department_id == Department.id)
        .join(Appointment, Appointment.doctor_id == Doctor.id)
        .group_by(Department.name)
        .all()
    )
    department_stats = [{"department": name, "appointment_count": c} for name, c in dept_stats]

    # 14-day window centred on today, with zero-filled days so the chart has no gaps
    start = today - timedelta(days=7)
    end = today + timedelta(days=6)
    rows = (
        db.query(Appointment.appointment_date, func.count(Appointment.id))
        .filter(Appointment.appointment_date >= start, Appointment.appointment_date <= end)
        .group_by(Appointment.appointment_date)
        .all()
    )
    by_day = {d: c for d, c in rows}
    appointment_trend = [
        {"date": str(start + timedelta(days=i)), "count": by_day.get(start + timedelta(days=i), 0)}
        for i in range(14)
    ]

    util_rows = (
        db.query(Doctor, func.count(Appointment.id))
        .join(Appointment, Appointment.doctor_id == Doctor.id)
        .group_by(Doctor.id)
        .order_by(func.count(Appointment.id).desc())
        .limit(6)
        .all()
    )
    doctor_utilization = [
        {"doctor": d.user.full_name, "specialization": d.specialization, "appointments": c}
        for d, c in util_rows
    ]

    recent = db.query(Appointment).order_by(Appointment.created_at.desc()).limit(8).all()
    recent_appointments = [
        {
            "id": a.id,
            "patient": a.patient.user.full_name,
            "doctor": a.doctor.user.full_name,
            "date": str(a.appointment_date),
            "time": str(a.appointment_time)[:5],
            "status": a.status.value,
            "risk": a.no_show_risk_score,
        }
        for a in recent
    ]

    return AdminDashboardOut(
        total_patients=total_patients,
        total_doctors=total_doctors,
        todays_appointments=todays_appointments,
        completed_appointments=completed,
        cancelled_appointments=cancelled,
        no_show_appointments=no_show,
        total_appointments=total_appointments,
        upcoming_appointments=upcoming,
        no_show_rate=no_show_rate,
        status_breakdown=status_breakdown,
        department_stats=department_stats,
        appointment_trend=appointment_trend,
        doctor_utilization=doctor_utilization,
        recent_appointments=recent_appointments,
    )
