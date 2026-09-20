"""
Seeds CareSync reference/demo data: an admin account, a set of clinical
departments, and a roster of doctors (each with weekly availability) so
the app has something realistic to browse right away.

Safe to re-run at any time. Every record is looked up by a stable unique
key before anything is created:
  - departments by name
  - the admin by email
  - each doctor by BOTH email and license_number (either match means
    "this doctor already exists" — skip it)
This means re-running the script never duplicates records and never
touches data it didn't create itself (existing patient accounts,
appointments, hand-edited fields on existing doctors, etc. are left
alone).

Run from the backend/ directory, with the same environment the API uses:
    python seed_demo_data.py
"""
from datetime import time

from app.core.security import hash_password
from app.db.database import Base, SessionLocal, engine
from app.models.models import Department, Doctor, DoctorAvailability, User, UserRole

ADMIN_EMAIL = "admin@caresync.local"
ADMIN_PASSWORD = "AdminPass123!"

# Every department these doctors need. Existing departments (matched by
# name) are left untouched; only missing ones are created.
DEPARTMENTS = {
    "General Medicine": "Primary and preventive care",
    "Cardiology": "Heart and cardiovascular care",
    "Dermatology": "Skin, hair, and nail care",
    "Orthopedics": "Bones, joints, and musculoskeletal care",
    "Pediatrics": "Care for infants, children, and adolescents",
}

# NOTE: the first entry's email is "dr.sharma@gmail.com" — kept in sync
# with the value already in your database (you updated it from the old
# @caresync.local address). If you rename this doctor's login email again
# by hand, update it here too, or the script will no longer recognize the
# existing record by email (it will still correctly skip it via the
# license-number match below, but this list is meant to describe your
# current data).
DOCTORS = [
    {
        "email": "dr.sharma@gmail.com",
        "password": "DoctorPass123!",
        "full_name": "Dr. Anjali Sharma",
        "department": "General Medicine",
        "specialization": "General Physician",
        "license_number": "DEMO-LIC-0001",
        "years_experience": 12,
        "consultation_fee": 400,
        "bio": "General physician seeing new and follow-up patients.",
    },
    {
        "email": "dr.mehta@gmail.com",
        "password": "DoctorPass123!",
        "full_name": "Dr. Rahul Mehta",
        "department": "Cardiology",
        "specialization": "Cardiologist",
        "license_number": "DEMO-LIC-0002",
        "years_experience": 15,
        "consultation_fee": 700,
        "bio": "Cardiologist focused on preventive heart health and cardiac rehabilitation.",
    },
    {
        "email": "dr.nair@gmail.com",
        "password": "DoctorPass123!",
        "full_name": "Dr. Priya Nair",
        "department": "Dermatology",
        "specialization": "Dermatologist",
        "license_number": "DEMO-LIC-0003",
        "years_experience": 9,
        "consultation_fee": 550,
        "bio": "Dermatologist treating common skin, hair, and nail conditions.",
    },
    {
        "email": "dr.rao@gmail.com",
        "password": "DoctorPass123!",
        "full_name": "Dr. Arjun Rao",
        "department": "Orthopedics",
        "specialization": "Orthopedic Surgeon",
        "license_number": "DEMO-LIC-0004",
        "years_experience": 18,
        "consultation_fee": 800,
        "bio": "Orthopedic surgeon specializing in joint replacement and sports injuries.",
    },
    {
        "email": "dr.kapoor@gmail.com",
        "password": "DoctorPass123!",
        "full_name": "Dr. Sneha Kapoor",
        "department": "Pediatrics",
        "specialization": "Pediatrician",
        "license_number": "DEMO-LIC-0005",
        "years_experience": 11,
        "consultation_fee": 450,
        "bio": "Pediatrician caring for infants, children, and adolescents.",
    },
]

# Weekly availability applied to every NEWLY created doctor above.
AVAILABILITY_DAYS = range(0, 5)  # Monday-Friday
AVAILABILITY_START = time(9, 0)
AVAILABILITY_END = time(13, 0)
AVAILABILITY_SLOT_MINUTES = 30


def seed_admin(db):
    if db.query(User).filter(User.email == ADMIN_EMAIL).first():
        print("Admin already exists, skipping.")
        return
    db.add(User(
        email=ADMIN_EMAIL,
        hashed_password=hash_password(ADMIN_PASSWORD),
        full_name="CareSync Admin",
        role=UserRole.admin,
    ))
    print(f"Created admin: {ADMIN_EMAIL} / {ADMIN_PASSWORD}")


def seed_departments(db):
    """Ensures every department in DEPARTMENTS exists; returns {name: Department}."""
    result = {}
    for name, description in DEPARTMENTS.items():
        dept = db.query(Department).filter(Department.name == name).first()
        if not dept:
            dept = Department(name=name, description=description)
            db.add(dept)
            db.flush()
            print(f"Created department: {name}")
        result[name] = dept
    return result


def seed_doctors(db, departments):
    for spec in DOCTORS:
        already_exists = (
            db.query(Doctor)
            .join(User, Doctor.user_id == User.id)
            .filter(
                (User.email == spec["email"]) | (Doctor.license_number == spec["license_number"])
            )
            .first()
        )
        if already_exists:
            print(f"Doctor already exists, skipping: {spec['full_name']} ({spec['email']})")
            continue

        # Defensive: a user with this email exists but isn't this doctor
        # (shouldn't happen in normal use, but avoids a unique-constraint
        # crash if it ever does).
        if db.query(User).filter(User.email == spec["email"]).first():
            print(
                f"A user with email {spec['email']} already exists under a different "
                f"role — skipping {spec['full_name']}. Give this doctor a different "
                f"email in DOCTORS if that's intentional."
            )
            continue

        doc_user = User(
            email=spec["email"],
            hashed_password=hash_password(spec["password"]),
            full_name=spec["full_name"],
            role=UserRole.doctor,
        )
        db.add(doc_user)
        db.flush()

        doctor = Doctor(
            user_id=doc_user.id,
            department_id=departments[spec["department"]].id,
            specialization=spec["specialization"],
            license_number=spec["license_number"],
            years_experience=spec["years_experience"],
            consultation_fee=spec["consultation_fee"],
            bio=spec["bio"],
        )
        db.add(doctor)
        db.flush()

        for day in AVAILABILITY_DAYS:
            db.add(DoctorAvailability(
                doctor_id=doctor.id, day_of_week=day,
                start_time=AVAILABILITY_START, end_time=AVAILABILITY_END,
                slot_duration_minutes=AVAILABILITY_SLOT_MINUTES,
            ))

        print(f"Created doctor: {spec['full_name']} ({spec['email']} / {spec['password']})")


def main():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_admin(db)
        departments = seed_departments(db)
        seed_doctors(db, departments)
        db.commit()
        print("\nSeed complete. Register a patient account from the app's sign-up form.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
