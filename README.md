# CareSync

**Smart Medical Appointment & Patient Management System**

CareSync is a portfolio-level, full-stack information system for a clinic:
patients book and manage appointments, doctors run their schedule and
patient notes, and admins oversee doctors, departments, and clinic-wide
analytics. A small set of AI features assist with scheduling operations —
predicting no-shows, categorizing appointment requests, and surfacing
scheduling trends.

> **CareSync is not a diagnostic tool.** It does not perform medical
> diagnosis, suggest treatment, or make clinical decisions. All AI
> features here are administrative/operational (scheduling risk,
> appointment triage, trend analytics), not medical. All data in this
> project is synthetic. **This system is a portfolio project and is not
> intended for real clinical use.**

---

## 1. Problem statement

Clinics juggle patient bookings, doctor schedules, and records across
phone calls, spreadsheets, and paper — leading to missed appointments,
double-bookings, and no shared view of what's happening today. CareSync
centralizes that workflow behind one API and one UI, with role-appropriate
views for patients, doctors, and administrators.

## 2. Objectives

- Give patients a self-service way to find a doctor, see real open slots,
  and manage their own appointments.
- Give doctors a daily worklist with status updates, consultation notes,
  and prescriptions in one place.
- Give admins a live operational picture: volumes, cancellations,
  no-shows, and department load.
- Use lightweight ML to flag likely no-shows and auto-tag the *type* of
  visit being requested, purely to help scheduling — not diagnosis.
- Build it the way a real product would be built: typed API contracts,
  role-based access control, a normalized relational schema, tests, and a
  container setup that can grow into a cloud deployment later.

## 3. Features

**Patient:** profile, search/filter doctors, view real-time availability,
book / reschedule / cancel appointments, appointment history, view
prescriptions and medical records, in-app notifications.

**Doctor:** today's and upcoming appointments, patient list with visit
history, update appointment status, add consultation notes, issue
prescriptions, manage weekly availability.

**Admin:** clinic-wide KPIs (patients, doctors, today's appointments,
completed/cancelled/no-show counts), appointment trend and department
charts, manage doctors and departments.

**AI (administrative only):**
| Feature | What it does |
|---|---|
| No-show prediction | RandomForestClassifier trained on synthetic historical appointment data; returns a probability + Low/Medium/High risk label for staff to see before a visit. |
| Appointment categorization | Classifies a booking's free-text reason into General Consultation / Follow-up / Routine Check-up / Specialist Consultation, to help triage slot length and routing. |
| Scheduling insights | Peak hours, busiest departments, cancellation/no-show rates, doctor utilization over a rolling window. |

## 4. Technology stack

| Layer | Choice |
|---|---|
| Frontend | React 18, React Router, Vite, plain CSS (no Tailwind, per project requirements), Recharts for admin charts |
| Backend | Python, FastAPI, Pydantic v2, SQLAlchemy 2.0 ORM, JWT (python-jose), bcrypt (passlib) |
| Database | PostgreSQL (SQLite supported for quick local runs without Docker) |
| AI/Data science | pandas, NumPy, scikit-learn, matplotlib, joblib |
| DevOps | Docker, Docker Compose, `.env` configuration |

## 5. System architecture & database design

See [`docs/architecture.md`](docs/architecture.md) for the system diagram,
full ER diagram, and an explanation of every relationship. Raw DDL is in
[`database/schema.sql`](database/schema.sql); the same schema is defined
as SQLAlchemy models in `backend/app/models/models.py` and is what the
running API actually uses (it creates tables automatically on startup for
local/demo convenience).

Ten tables: `users`, `patients`, `doctors`, `departments`,
`doctor_availability`, `appointments`, `medical_records`, `prescriptions`,
`prescription_items`, `notifications` — with foreign keys, a unique
constraint that prevents double-booking a doctor's slot at the database
level, and indexes on every foreign key and frequently-filtered column
(status, date, role, specialization).

## 6. AI methodology

### No-show prediction
- **Data**: `ml/generate_synthetic_data.py` synthesizes 6,000 historical
  appointment rows (age, prior appointment/no-show/cancellation counts,
  lead time, day of week, hour) with a noisy logistic relationship to a
  no-show label — deliberately imperfect so the model isn't trivially
  100% accurate.
- **Preprocessing**: no scaling needed (tree-based model); stratified
  80/20 train/test split so both sets keep the same no-show rate.
- **Model**: `RandomForestClassifier` (200 trees, max depth 8,
  `class_weight="balanced"`) — chosen for robustness on mixed-scale
  tabular features and interpretable feature importances, without a
  feature-scaling step.
- **Evaluation** (on synthetic test data, your numbers will vary slightly
  with re-training):

  | Metric | Score |
  |---|---|
  | Accuracy | ~0.67 |
  | Precision | ~0.43 |
  | Recall | ~0.48 |
  | F1-score | ~0.46 |

  Confusion matrix and full console output are produced by
  `ml/train_no_show_model.py` and saved to `ml/confusion_matrix.png`.
  Lead time, prior no-shows, and patient age were the strongest
  predictors in testing.
- **Disclaimer**: this is a scheduling-risk estimate from synthetic data.
  It is **not medically validated** and must never be used for clinical
  decision-making — the API response includes this disclaimer verbatim.

### Appointment categorization
A transparent keyword/heuristic classifier
(`backend/app/ml/categorization.py`) maps a booking's free-text reason to
one of four administrative categories. It's intentionally rule-based
rather than a black-box model — the mapping needs to be auditable by
clinic staff, and the categories are closed-set and easy to describe with
keywords.

### Scheduling insights
Plain SQL aggregation (`GET /ai/scheduling-insights`) over a 90-day
window: peak booking hours, busiest departments, cancellation/no-show
rates, and per-doctor appointment counts.

## 7. API documentation

Interactive Swagger/OpenAPI docs are generated automatically by FastAPI
at **`/docs`** (and ReDoc at `/redoc`) once the backend is running.

Representative endpoints:

```
POST   /auth/register
POST   /auth/login
GET    /auth/me

GET    /patients/{id}
PUT    /patients/{id}

GET    /doctors
GET    /doctors/{id}
GET    /doctors/{id}/available-slots?for_date=YYYY-MM-DD
POST   /doctors/{id}/availability

POST   /appointments
GET    /appointments
PUT    /appointments/{id}/reschedule
PUT    /appointments/{id}/cancel
PUT    /appointments/{id}/status
PUT    /appointments/{id}/notes

GET    /medical-records/{patient_id}
POST   /prescriptions
GET    /prescriptions/patient/{patient_id}

GET    /admin/dashboard
POST   /admin/departments
POST   /admin/doctors

POST   /ai/no-show-prediction
POST   /ai/categorize
GET    /ai/scheduling-insights
```

## 8. Installation & running locally

### Option A — Docker Compose (recommended)

```bash
cp .env.example .env      # edit values as needed
docker compose up --build
```

- Backend: http://localhost:8000 (docs at `/docs`)
- Frontend: http://localhost:3000
- PostgreSQL: localhost:5432

Then seed a demo admin/doctor account:

```bash
docker compose exec backend python seed_demo_data.py
```

### Option B — run without Docker (Windows/Mac/Linux)

**Backend**

```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # macOS/Linux

pip install -r requirements.txt

# Quick local run without installing Postgres:
set DATABASE_URL=sqlite:///./caresync.db      # Windows (cmd)
# export DATABASE_URL=sqlite:///./caresync.db # macOS/Linux
set JWT_SECRET_KEY=dev-secret

python seed_demo_data.py
uvicorn app.main:app --reload
```

**Frontend** (separate terminal)

```bash
cd frontend
npm install
npm run dev
```

Visit http://localhost:5173. Demo credentials after seeding:

| Role | Email | Password |
|---|---|---|
| Admin | admin@caresync.local | AdminPass123! |
| Doctor | dr.sharma@caresync.local | DoctorPass123! |

Sign up a patient account directly from the app's login screen.

### Training the no-show model

A model is required for `/ai/no-show-prediction` to use a real trained
classifier (otherwise it falls back to a transparent heuristic):

```bash
cd ml
pip install -r ../backend/requirements.txt   # or your existing backend venv
python generate_synthetic_data.py
python train_no_show_model.py
```

This writes `backend/app/ml/no_show_model.joblib`, which the API loads on
next restart.

## 9. Docker

`docker-compose.yml` runs three services: `db` (PostgreSQL 16),
`backend` (FastAPI, built from `backend/Dockerfile`), and `frontend`
(built and served from `frontend/Dockerfile`). All configuration is
via environment variables — see `.env.example`. No secrets are hardcoded
anywhere in the codebase.

## 9b. Deploying to Render

`render.yaml` in the repo root is a Render Blueprint that provisions a
free Postgres database, the backend as a Docker web service, and the
frontend as a static site.

1. Push this repo to GitHub (Render deploys from a Git repo, not a zip).
2. In the Render dashboard: **New > Blueprint**, point it at the repo.
   Render reads `render.yaml` and shows you the three resources
   (`caresync-db`, `caresync-backend`, `caresync-frontend`) to create.
3. Deploy. `JWT_SECRET_KEY` is auto-generated and `DATABASE_URL` is wired
   to the new database automatically.
4. Once `caresync-backend` is live, copy its URL (e.g.
   `https://caresync-backend.onrender.com`).
5. On `caresync-frontend`, set the env var `VITE_API_URL` to that backend
   URL and trigger a manual redeploy (Vite bakes env vars in at build
   time, so this step is required — setting it once at blueprint-creation
   won't pick up a URL that didn't exist yet).
6. On `caresync-backend`, set `ALLOWED_ORIGINS` to the frontend's Render
   URL (e.g. `https://caresync-frontend.onrender.com`) so CORS allows it,
   then redeploy the backend.
7. Open a shell on the backend service (Render dashboard > Shell) and run
   `python seed_demo_data.py` to get a working admin/doctor login.

Free-tier Render web services spin down after inactivity, so the first
request after idle time will be slow — normal for a demo, worth
mentioning if you're showing this in an interview.

## 10. Project structure

```
caresync/
├── frontend/           React + Vite SPA
├── backend/             FastAPI app, tests, seed script
│   └── app/
│       ├── core/         config, security, auth deps
│       ├── db/            SQLAlchemy engine/session
│       ├── models/       ORM models
│       ├── schemas/     Pydantic request/response schemas
│       ├── routers/      one file per resource
│       └── ml/            no-show model + categorization
├── ml/                  offline training scripts (synthetic data, model training)
├── database/            raw schema.sql
├── docs/                  architecture.md (system diagram + ER diagram)
├── docker-compose.yml
├── .env.example
└── README.md
```

## 11. Testing

```bash
cd backend
pip install -r requirements.txt
pytest -q
```

Covers: registration/login, duplicate-email and admin-self-register
rejection, role-based access control on protected endpoints, appointment
booking (including the double-booking conflict path), rescheduling,
cancellation, availability/slot computation, the AI prediction and
categorization endpoints, and the admin dashboard.

## 12. Future improvements

- Alembic migrations instead of `create_all` for real deployments
- Email/SMS appointment reminders (the `notifications` table is already
  shaped for this)
- Refresh tokens / token revocation
- AWS deployment: RDS for Postgres, ECS/Fargate or Elastic Beanstalk for
  the API, S3 + CloudFront for the frontend — the app already reads all
  config from environment variables, so no redesign is needed to get
  there
- Pagination on list endpoints for larger datasets
- Richer categorization model (e.g. a small text classifier) once real
  labeled data exists

## 13. Disclaimer

CareSync is a student/portfolio project built with **synthetic data
only**. It does not provide medical diagnosis, treatment recommendations,
or clinical decision-making of any kind, and it is **not intended for use
with real patient data or in a real clinical setting**.
