"""
CareSync database models.

Tables: users, patients, doctors, departments, doctor_availability,
appointments, medical_records, prescriptions, prescription_items, notifications.
"""
import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean, Column, Date, DateTime, Enum, Float, ForeignKey, Integer,
    String, Text, Time, UniqueConstraint, Index
)
from sqlalchemy.orm import relationship

from app.db.database import Base


def gen_uuid() -> str:
    return str(uuid.uuid4())


class UserRole(str, enum.Enum):
    patient = "patient"
    doctor = "doctor"
    admin = "admin"


class AppointmentStatus(str, enum.Enum):
    scheduled = "scheduled"
    confirmed = "confirmed"
    completed = "completed"
    cancelled = "cancelled"
    no_show = "no_show"


class AppointmentCategory(str, enum.Enum):
    general_consultation = "general_consultation"
    follow_up = "follow_up"
    routine_checkup = "routine_checkup"
    specialist_consultation = "specialist_consultation"


class NotificationType(str, enum.Enum):
    appointment_booked = "appointment_booked"
    appointment_reminder = "appointment_reminder"
    appointment_status_change = "appointment_status_change"
    prescription_added = "prescription_added"
    system = "system"


# ---------------------------------------------------------------------------
# Users (auth identity shared by patients, doctors, admins)
# ---------------------------------------------------------------------------
class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), nullable=False, default=UserRole.patient)
    full_name = Column(String(255), nullable=False)
    phone = Column(String(20), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    patient_profile = relationship("Patient", back_populates="user", uselist=False, cascade="all, delete-orphan")
    doctor_profile = relationship("Doctor", back_populates="user", uselist=False, cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")

    __table_args__ = (Index("ix_users_role", "role"),)


# ---------------------------------------------------------------------------
# Departments
# ---------------------------------------------------------------------------
class Department(Base):
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(150), unique=True, nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    doctors = relationship("Doctor", back_populates="department")


# ---------------------------------------------------------------------------
# Patients
# ---------------------------------------------------------------------------
class Patient(Base):
    __tablename__ = "patients"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    date_of_birth = Column(Date, nullable=True)
    gender = Column(String(20), nullable=True)
    blood_group = Column(String(5), nullable=True)
    address = Column(Text, nullable=True)
    emergency_contact = Column(String(20), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="patient_profile")
    appointments = relationship("Appointment", back_populates="patient", cascade="all, delete-orphan")
    medical_records = relationship("MedicalRecord", back_populates="patient", cascade="all, delete-orphan")

    __table_args__ = (Index("ix_patients_user_id", "user_id"),)


# ---------------------------------------------------------------------------
# Doctors
# ---------------------------------------------------------------------------
class Doctor(Base):
    __tablename__ = "doctors"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)
    specialization = Column(String(150), nullable=False)
    license_number = Column(String(100), unique=True, nullable=False)
    years_experience = Column(Integer, default=0)
    consultation_fee = Column(Float, default=0.0)
    bio = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="doctor_profile")
    department = relationship("Department", back_populates="doctors")
    availability_slots = relationship("DoctorAvailability", back_populates="doctor", cascade="all, delete-orphan")
    appointments = relationship("Appointment", back_populates="doctor", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_doctors_department_id", "department_id"),
        Index("ix_doctors_specialization", "specialization"),
    )


# ---------------------------------------------------------------------------
# Doctor availability
# ---------------------------------------------------------------------------
class DoctorAvailability(Base):
    __tablename__ = "doctor_availability"

    id = Column(Integer, primary_key=True, autoincrement=True)
    doctor_id = Column(String(36), ForeignKey("doctors.id", ondelete="CASCADE"), nullable=False)
    day_of_week = Column(Integer, nullable=False)  # 0=Monday ... 6=Sunday
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    slot_duration_minutes = Column(Integer, default=30, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    doctor = relationship("Doctor", back_populates="availability_slots")

    __table_args__ = (
        Index("ix_availability_doctor_day", "doctor_id", "day_of_week"),
    )


# ---------------------------------------------------------------------------
# Appointments
# ---------------------------------------------------------------------------
class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    patient_id = Column(String(36), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    doctor_id = Column(String(36), ForeignKey("doctors.id", ondelete="CASCADE"), nullable=False)
    appointment_date = Column(Date, nullable=False)
    appointment_time = Column(Time, nullable=False)
    status = Column(Enum(AppointmentStatus), default=AppointmentStatus.scheduled, nullable=False)
    category = Column(Enum(AppointmentCategory), nullable=True)  # set by AI categorization
    reason = Column(Text, nullable=True)
    consultation_notes = Column(Text, nullable=True)
    no_show_risk_score = Column(Float, nullable=True)  # AI-predicted probability (0-1)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    patient = relationship("Patient", back_populates="appointments")
    doctor = relationship("Doctor", back_populates="appointments")
    prescriptions = relationship("Prescription", back_populates="appointment", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("doctor_id", "appointment_date", "appointment_time", name="uq_doctor_slot"),
        Index("ix_appointments_patient", "patient_id"),
        Index("ix_appointments_doctor", "doctor_id"),
        Index("ix_appointments_date", "appointment_date"),
        Index("ix_appointments_status", "status"),
    )


# ---------------------------------------------------------------------------
# Medical records
# ---------------------------------------------------------------------------
class MedicalRecord(Base):
    __tablename__ = "medical_records"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    patient_id = Column(String(36), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    appointment_id = Column(String(36), ForeignKey("appointments.id", ondelete="SET NULL"), nullable=True)
    record_type = Column(String(100), nullable=False, default="consultation_summary")
    notes = Column(Text, nullable=True)
    attachments_url = Column(String(500), nullable=True)
    created_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    patient = relationship("Patient", back_populates="medical_records")

    __table_args__ = (Index("ix_records_patient", "patient_id"),)


# ---------------------------------------------------------------------------
# Prescriptions
# ---------------------------------------------------------------------------
class Prescription(Base):
    __tablename__ = "prescriptions"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    appointment_id = Column(String(36), ForeignKey("appointments.id", ondelete="CASCADE"), nullable=False)
    doctor_id = Column(String(36), ForeignKey("doctors.id"), nullable=False)
    patient_id = Column(String(36), ForeignKey("patients.id"), nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    appointment = relationship("Appointment", back_populates="prescriptions")
    items = relationship("PrescriptionItem", back_populates="prescription", cascade="all, delete-orphan")

    __table_args__ = (Index("ix_prescriptions_patient", "patient_id"),)


class PrescriptionItem(Base):
    __tablename__ = "prescription_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    prescription_id = Column(String(36), ForeignKey("prescriptions.id", ondelete="CASCADE"), nullable=False)
    medicine_name = Column(String(255), nullable=False)
    dosage = Column(String(100), nullable=False)
    frequency = Column(String(100), nullable=False)
    duration_days = Column(Integer, nullable=False)
    instructions = Column(String(500), nullable=True)

    prescription = relationship("Prescription", back_populates="items")


# ---------------------------------------------------------------------------
# Notifications
# ---------------------------------------------------------------------------
class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    type = Column(Enum(NotificationType), nullable=False, default=NotificationType.system)
    message = Column(String(500), nullable=False)
    is_read = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="notifications")

    __table_args__ = (Index("ix_notifications_user", "user_id", "is_read"),)
