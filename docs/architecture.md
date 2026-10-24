# CareSync — Architecture

## System architecture

```mermaid
flowchart LR
    subgraph Client
        A[React SPA served by nginx<br/>API address from runtime config.js]
    end

    subgraph API["Backend — FastAPI"]
        B[Auth Router<br/>JWT + bcrypt]
        C[Domain Routers<br/>patients / doctors / appointments /<br/>medical-records / prescriptions / admin]
        D[AI Module<br/>no-show model · categorization · insights]
    end

    subgraph Data
        E[(PostgreSQL)]
    end

    A -- REST / JSON, Bearer token --> B
    A -- REST / JSON, Bearer token --> C
    C --> D
    B --> E
    C --> E
    D -. reads historical data .-> E
```

The frontend never talks to PostgreSQL directly — every read/write goes
through the FastAPI layer, which enforces role-based access control and
input validation before touching the database.

## Database ER diagram

```mermaid
erDiagram
    USERS ||--o| PATIENTS : "has profile"
    USERS ||--o| DOCTORS : "has profile"
    USERS ||--o{ NOTIFICATIONS : receives
    DEPARTMENTS ||--o{ DOCTORS : employs
    DOCTORS ||--o{ DOCTOR_AVAILABILITY : defines
    DOCTORS ||--o{ APPOINTMENTS : attends
    PATIENTS ||--o{ APPOINTMENTS : books
    PATIENTS ||--o{ MEDICAL_RECORDS : owns
    APPOINTMENTS ||--o{ PRESCRIPTIONS : yields
    PRESCRIPTIONS ||--o{ PRESCRIPTION_ITEMS : contains
    APPOINTMENTS ||--o| MEDICAL_RECORDS : "may generate"

    USERS {
        string id PK
        string email UK
        string hashed_password
        enum role
        string full_name
        boolean is_active
    }
    PATIENTS {
        string id PK
        string user_id FK
        date date_of_birth
        string gender
        string blood_group
    }
    DOCTORS {
        string id PK
        string user_id FK
        int department_id FK
        string specialization
        string license_number UK
        float consultation_fee
    }
    DEPARTMENTS {
        int id PK
        string name UK
    }
    DOCTOR_AVAILABILITY {
        int id PK
        string doctor_id FK
        int day_of_week
        time start_time
        time end_time
    }
    APPOINTMENTS {
        string id PK
        string patient_id FK
        string doctor_id FK
        date appointment_date
        time appointment_time
        enum status
        enum category
        float no_show_risk_score
    }
    MEDICAL_RECORDS {
        string id PK
        string patient_id FK
        string appointment_id FK
        string record_type
    }
    PRESCRIPTIONS {
        string id PK
        string appointment_id FK
        string doctor_id FK
        string patient_id FK
    }
    PRESCRIPTION_ITEMS {
        int id PK
        string prescription_id FK
        string medicine_name
        string dosage
    }
    NOTIFICATIONS {
        int id PK
        string user_id FK
        enum type
        boolean is_read
    }
```

## Relationship explanation

- **users → patients / doctors** (1:1): `users` is the single identity and
  auth table for every role. A patient or doctor account is a `users` row
  plus a matching profile row holding role-specific fields. Admins have a
  `users` row only.
- **departments → doctors** (1:N): a department groups doctors by
  specialty area for filtering and dashboard rollups; `department_id` is
  nullable so a doctor can exist before being assigned one.
- **doctors → doctor_availability** (1:N): each row is a recurring weekly
  block (day of week + time range + slot length) the booking engine
  expands into concrete open slots for a given date.
- **patients / doctors → appointments** (1:N each): the transactional
  center of the schema. A unique constraint on
  `(doctor_id, appointment_date, appointment_time)` prevents double-booking
  at the database level, not just in application code.
- **appointments → prescriptions → prescription_items** (1:N, 1:N): a
  prescription belongs to exactly one appointment; each prescription can
  list multiple medicines.
- **patients → medical_records** (1:N), optionally linked back to the
  appointment that generated them.
- **users → notifications** (1:N): in-app notifications for booking,
  status changes, and new prescriptions.

## Why these choices

- **UUID string primary keys** on the high-write, externally-referenced
  tables (`users`, `patients`, `doctors`, `appointments`, `medical_records`,
  `prescriptions`) avoid leaking sequential record counts through the API
  and make client-side optimistic IDs straightforward. Lookup/child tables
  (`departments`, `doctor_availability`, `prescription_items`,
  `notifications`) use plain auto-incrementing integers since they're
  never referenced outside the backend.
- **Enums at the database level** (`appointment_status`, `user_role`, ...)
  keep invalid states from ever reaching the database, on top of Pydantic
  validation at the API boundary.
- **The no-show risk score lives on the appointment row**, not in a
  separate predictions table, because it's a point-in-time estimate tied
  to one appointment, not a record that needs its own history.


## Deployment topology (Azure)

```mermaid
flowchart LR
    U[Browser] --> W[Container App: caresync-web<br/>nginx + React build]
    U --> A[Container App: caresync-api<br/>FastAPI + in-process model]
    W -. serves SPA .-> U
    A --> P[(Azure Database for PostgreSQL<br/>Flexible Server, SSL)]
    R[Azure Container Registry] -. images .-> W
    R -. images .-> A
```

* Images are built in Azure (`az acr build`) from `backend/` and `frontend/`.
* `API_URL` is injected into the web container at start; `ALLOWED_ORIGINS` on the API is set to the web app's URL.
* Secrets (database URL, JWT key, seed passwords) are Container Apps secrets referenced by name, never baked into images.
