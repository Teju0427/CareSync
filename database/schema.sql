-- =============================================================================
-- CareSync database schema (PostgreSQL)
-- Mirrors backend/app/models/models.py. In normal development the backend
-- creates these tables automatically on startup (Base.metadata.create_all);
-- this file is provided for reference, review, and manual provisioning of
-- a production database via `psql -f database/schema.sql`.
-- =============================================================================

CREATE TYPE user_role AS ENUM ('patient', 'doctor', 'admin');
CREATE TYPE appointment_status AS ENUM ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show');
CREATE TYPE appointment_category AS ENUM (
    'general_consultation', 'follow_up', 'routine_checkup', 'specialist_consultation'
);
CREATE TYPE notification_type AS ENUM (
    'appointment_booked', 'appointment_reminder', 'appointment_status_change',
    'prescription_added', 'system'
);

-- ---------------------------------------------------------------------------
-- users : shared identity + auth for all three roles
-- ---------------------------------------------------------------------------
CREATE TABLE users (
    id              VARCHAR(36) PRIMARY KEY,
    email           VARCHAR(255) NOT NULL UNIQUE,
    hashed_password VARCHAR(255) NOT NULL,
    role            user_role NOT NULL DEFAULT 'patient',
    full_name       VARCHAR(255) NOT NULL,
    phone           VARCHAR(20),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP
);
CREATE INDEX ix_users_role ON users (role);

-- ---------------------------------------------------------------------------
-- departments
-- ---------------------------------------------------------------------------
CREATE TABLE departments (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(150) NOT NULL UNIQUE,
    description TEXT,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- patients : one-to-one with users
-- ---------------------------------------------------------------------------
CREATE TABLE patients (
    id                  VARCHAR(36) PRIMARY KEY,
    user_id             VARCHAR(36) NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    date_of_birth       DATE,
    gender              VARCHAR(20),
    blood_group         VARCHAR(5),
    address             TEXT,
    emergency_contact   VARCHAR(20),
    created_at          TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_patients_user_id ON patients (user_id);

-- ---------------------------------------------------------------------------
-- doctors : one-to-one with users, many-to-one with departments
-- ---------------------------------------------------------------------------
CREATE TABLE doctors (
    id                  VARCHAR(36) PRIMARY KEY,
    user_id             VARCHAR(36) NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    department_id       INTEGER REFERENCES departments(id) ON DELETE SET NULL,
    specialization      VARCHAR(150) NOT NULL,
    license_number      VARCHAR(100) NOT NULL UNIQUE,
    years_experience    INTEGER NOT NULL DEFAULT 0,
    consultation_fee    FLOAT NOT NULL DEFAULT 0,
    bio                 TEXT,
    created_at          TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_doctors_department_id ON doctors (department_id);
CREATE INDEX ix_doctors_specialization ON doctors (specialization);

-- ---------------------------------------------------------------------------
-- doctor_availability : recurring weekly time blocks
-- ---------------------------------------------------------------------------
CREATE TABLE doctor_availability (
    id                      SERIAL PRIMARY KEY,
    doctor_id               VARCHAR(36) NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    day_of_week              INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Mon ... 6=Sun
    start_time               TIME NOT NULL,
    end_time                 TIME NOT NULL,
    slot_duration_minutes    INTEGER NOT NULL DEFAULT 30,
    is_active                 BOOLEAN NOT NULL DEFAULT TRUE,
    CHECK (end_time > start_time)
);
CREATE INDEX ix_availability_doctor_day ON doctor_availability (doctor_id, day_of_week);

-- ---------------------------------------------------------------------------
-- appointments : the central transactional table
-- ---------------------------------------------------------------------------
CREATE TABLE appointments (
    id                   VARCHAR(36) PRIMARY KEY,
    patient_id           VARCHAR(36) NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    doctor_id            VARCHAR(36) NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    appointment_date     DATE NOT NULL,
    appointment_time     TIME NOT NULL,
    status               appointment_status NOT NULL DEFAULT 'scheduled',
    category             appointment_category,
    reason               TEXT,
    consultation_notes   TEXT,
    no_show_risk_score   FLOAT,
    created_at           TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMP,
    CONSTRAINT uq_doctor_slot UNIQUE (doctor_id, appointment_date, appointment_time)
);
CREATE INDEX ix_appointments_patient ON appointments (patient_id);
CREATE INDEX ix_appointments_doctor ON appointments (doctor_id);
CREATE INDEX ix_appointments_date ON appointments (appointment_date);
CREATE INDEX ix_appointments_status ON appointments (status);

-- ---------------------------------------------------------------------------
-- medical_records
-- ---------------------------------------------------------------------------
CREATE TABLE medical_records (
    id                VARCHAR(36) PRIMARY KEY,
    patient_id        VARCHAR(36) NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    appointment_id    VARCHAR(36) REFERENCES appointments(id) ON DELETE SET NULL,
    record_type       VARCHAR(100) NOT NULL DEFAULT 'consultation_summary',
    notes             TEXT,
    attachments_url   VARCHAR(500),
    created_by        VARCHAR(36) REFERENCES users(id),
    created_at        TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_records_patient ON medical_records (patient_id);

-- ---------------------------------------------------------------------------
-- prescriptions + prescription_items
-- ---------------------------------------------------------------------------
CREATE TABLE prescriptions (
    id               VARCHAR(36) PRIMARY KEY,
    appointment_id   VARCHAR(36) NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
    doctor_id        VARCHAR(36) NOT NULL REFERENCES doctors(id),
    patient_id       VARCHAR(36) NOT NULL REFERENCES patients(id),
    notes            TEXT,
    created_at       TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_prescriptions_patient ON prescriptions (patient_id);

CREATE TABLE prescription_items (
    id                SERIAL PRIMARY KEY,
    prescription_id   VARCHAR(36) NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
    medicine_name     VARCHAR(255) NOT NULL,
    dosage            VARCHAR(100) NOT NULL,
    frequency         VARCHAR(100) NOT NULL,
    duration_days     INTEGER NOT NULL,
    instructions      VARCHAR(500)
);

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
CREATE TABLE notifications (
    id           SERIAL PRIMARY KEY,
    user_id      VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type         notification_type NOT NULL DEFAULT 'system',
    message      VARCHAR(500) NOT NULL,
    is_read      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_notifications_user ON notifications (user_id, is_read);
