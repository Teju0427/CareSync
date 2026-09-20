"""
Pydantic schemas for request validation and response serialization.
"""
from datetime import date, datetime, time
from typing import Optional

from pydantic import BaseModel, EmailStr, Field

from app.models.models import AppointmentCategory, AppointmentStatus, NotificationType, UserRole


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------
class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str
    phone: Optional[str] = None
    role: UserRole = UserRole.patient


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: UserRole
    user_id: str
    full_name: str


class UserOut(BaseModel):
    id: str
    email: EmailStr
    full_name: str
    role: UserRole
    phone: Optional[str] = None
    is_active: bool

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Departments
# ---------------------------------------------------------------------------
class DepartmentCreate(BaseModel):
    name: str
    description: Optional[str] = None


class DepartmentOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = None

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Patients
# ---------------------------------------------------------------------------
class PatientProfileUpdate(BaseModel):
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    blood_group: Optional[str] = None
    address: Optional[str] = None
    emergency_contact: Optional[str] = None


class PatientOut(BaseModel):
    id: str
    user_id: str
    full_name: str
    email: EmailStr
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    blood_group: Optional[str] = None
    address: Optional[str] = None
    emergency_contact: Optional[str] = None

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Doctors
# ---------------------------------------------------------------------------
class DoctorCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str
    phone: Optional[str] = None
    department_id: Optional[int] = None
    specialization: str
    license_number: str
    years_experience: int = 0
    consultation_fee: float = 0.0
    bio: Optional[str] = None


class DoctorUpdate(BaseModel):
    department_id: Optional[int] = None
    specialization: Optional[str] = None
    years_experience: Optional[int] = None
    consultation_fee: Optional[float] = None
    bio: Optional[str] = None


class DoctorOut(BaseModel):
    id: str
    full_name: str
    email: EmailStr
    department_id: Optional[int] = None
    department_name: Optional[str] = None
    specialization: str
    license_number: str
    years_experience: int
    consultation_fee: float
    bio: Optional[str] = None

    class Config:
        from_attributes = True


class AvailabilityCreate(BaseModel):
    day_of_week: int = Field(ge=0, le=6, description="0=Monday ... 6=Sunday")
    start_time: time
    end_time: time
    slot_duration_minutes: int = 30


class AvailabilityOut(AvailabilityCreate):
    id: int
    doctor_id: str
    is_active: bool

    class Config:
        from_attributes = True


class AvailableSlotOut(BaseModel):
    date: date
    time: time


# ---------------------------------------------------------------------------
# Appointments
# ---------------------------------------------------------------------------
class AppointmentCreate(BaseModel):
    doctor_id: str
    appointment_date: date
    appointment_time: time
    reason: Optional[str] = None


class AppointmentReschedule(BaseModel):
    appointment_date: date
    appointment_time: time


class AppointmentStatusUpdate(BaseModel):
    status: AppointmentStatus


class ConsultationNotesUpdate(BaseModel):
    consultation_notes: str


class AppointmentOut(BaseModel):
    id: str
    patient_id: str
    patient_name: Optional[str] = None
    doctor_id: str
    doctor_name: Optional[str] = None
    appointment_date: date
    appointment_time: time
    status: AppointmentStatus
    category: Optional[AppointmentCategory] = None
    reason: Optional[str] = None
    consultation_notes: Optional[str] = None
    no_show_risk_score: Optional[float] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Medical records
# ---------------------------------------------------------------------------
class MedicalRecordCreate(BaseModel):
    patient_id: str
    appointment_id: Optional[str] = None
    record_type: str = "consultation_summary"
    notes: Optional[str] = None
    attachments_url: Optional[str] = None


class MedicalRecordOut(BaseModel):
    id: str
    patient_id: str
    appointment_id: Optional[str] = None
    record_type: str
    notes: Optional[str] = None
    attachments_url: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Prescriptions
# ---------------------------------------------------------------------------
class PrescriptionItemCreate(BaseModel):
    medicine_name: str
    dosage: str
    frequency: str
    duration_days: int
    instructions: Optional[str] = None


class PrescriptionCreate(BaseModel):
    appointment_id: str
    notes: Optional[str] = None
    items: list[PrescriptionItemCreate]


class PrescriptionItemOut(PrescriptionItemCreate):
    id: int

    class Config:
        from_attributes = True


class PrescriptionOut(BaseModel):
    id: str
    appointment_id: str
    doctor_id: str
    patient_id: str
    notes: Optional[str] = None
    created_at: datetime
    items: list[PrescriptionItemOut] = []

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Notifications
# ---------------------------------------------------------------------------
class NotificationOut(BaseModel):
    id: int
    type: NotificationType
    message: str
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# AI
# ---------------------------------------------------------------------------
class NoShowPredictionRequest(BaseModel):
    patient_age: int
    previous_appointments: int
    previous_no_shows: int
    previous_cancellations: int
    lead_time_days: int
    day_of_week: int = Field(ge=0, le=6)
    appointment_hour: int = Field(ge=0, le=23)


class NoShowPredictionResponse(BaseModel):
    no_show_probability: float
    risk_level: str
    disclaimer: str = "Administrative scheduling estimate only — not a medical or clinical assessment."


class CategorizationRequest(BaseModel):
    reason: str


class CategorizationResponse(BaseModel):
    category: AppointmentCategory
    confidence: float


# ---------------------------------------------------------------------------
# Admin dashboard
# ---------------------------------------------------------------------------
class AdminDashboardOut(BaseModel):
    total_patients: int
    total_doctors: int
    todays_appointments: int
    completed_appointments: int
    cancelled_appointments: int
    no_show_appointments: int
    department_stats: list[dict]
    appointment_trend: list[dict]
