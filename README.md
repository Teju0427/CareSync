# CareSync

**Clinic appointments, patient records and operations in one place** — a full-stack portfolio project with role-based access (patient / doctor / admin), real-time slot booking, and administrative AI that estimates appointment no-show risk.

> ⚠️ **Not for clinical use.** CareSync does not diagnose, recommend treatment or make clinical decisions. The AI features are scheduling aids only. All data is synthetic.

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, React Router, Recharts, lucide-react, hand-built CSS design system |
| Backend | Python, FastAPI, Pydantic v2, SQLAlchemy 2, JWT (python-jose), bcrypt |
| Database | PostgreSQL (SQLite for quick local runs and tests) |
| AI / data | scikit-learn RandomForest (no-show risk), rule-based visit categoriser, pandas/NumPy |
| Delivery | Docker, Docker Compose, nginx, GitHub Actions CI, **Azure Container Apps** + Azure Database for PostgreSQL |
| Tests | pytest (28 API tests) · Vitest (20 page-render tests) |

## What each role gets

**Patients** — search doctors by name/department · pick a date and slot from a live availability strip · book, reschedule and cancel · see upcoming/past/cancelled visits · view and print prescriptions · view records · edit profile · change password · in-app notifications.

**Doctors** — daily dashboard (still to see, completed, high no-show risk) · one consultation workspace for status, notes and prescriptions · full appointment list with search · patient charts (profile, visits, records, prescriptions, add chart notes) limited to patients they have actually treated · visual weekly availability editor.

**Admins** — analytics dashboard (KPIs, 14-day trend, status mix, department load, doctor utilisation, recent bookings) · manage appointments, doctors (add/edit/remove), patients and departments.

## Architecture

```
Browser ──HTTPS──► nginx (React build) ──REST + Bearer JWT──► FastAPI ──► PostgreSQL
                       │                                         │
              config.js written at                      in-process scikit-learn model
              container start (API_URL)                 + rule-based categoriser
```

* The frontend reads the API address from `config.js` **at container start**, so one built image runs anywhere with no rebuild.
* The AI model runs in-process inside FastAPI — deliberately no separate ML service at this scale.
* A unique DB constraint on `(doctor, date, time)` makes double-booking impossible even under a race.
* Doctors can only open charts of patients they have an appointment with (enforced server-side, tested).

More detail and the ER diagram: [`docs/architecture.md`](docs/architecture.md).

## Run locally

**Docker (recommended)**
```bash
cp .env.example .env        # Windows: copy .env.example .env  (then edit the values)
docker compose up --build
```
Web `http://localhost:3000` · API docs `http://localhost:8000/docs`. Demo data is created automatically on first start (`SEED_DEMO_DATA=true`); logins use the passwords you set in `.env` (defaults for local dev only: admin `admin@caresync.app` / `AdminPass123!`, doctors e.g. `dr.sharma@gmail.com` / `DoctorPass123!`). Register a patient from the sign-up screen.

**Without Docker**
```bash
# backend
cd backend && python -m venv venv && venv\Scripts\activate   # macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
set DATABASE_URL=sqlite:///./caresync.db & set JWT_SECRET_KEY=dev & set SEED_DEMO_DATA=true   # use export on macOS/Linux
uvicorn app.main:app --reload
# frontend (second terminal)
cd frontend && npm install && npm run dev      # http://localhost:5173 (proxies /api to :8000)
```

## Deploy to Azure

Prerequisites: an Azure subscription and the [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli). **No local Docker needed** — images are built inside Azure.

```powershell
az login
./deploy/azure/deploy.ps1 -Location centralindia      # Windows PowerShell / PowerShell 7
# or:  ./deploy/azure/deploy.sh centralindia           # macOS, Linux, WSL, Cloud Shell
```

This creates a resource group containing: Azure Container Registry · Azure Database for PostgreSQL Flexible Server (B1ms, Postgres 16, SSL required) · a Container Apps environment · two container apps (`caresync-api`, `caresync-web`). Generated secrets (DB password, JWT key, demo passwords) are saved to `deploy/azure/.state.json` (git-ignored) and printed at the end along with your URLs.

* **Update after code changes:** run the same script again — it reuses everything and rolls out a new image.
* **Region errors on student/free subscriptions:** retry with another `-Location` (e.g. `southeastasia`, `eastus2`).
* **Logs:** `az containerapp logs show -n caresync-api -g caresync-rg --follow`
* **Save money / stop charges:** `./deploy/azure/destroy.ps1` deletes the whole resource group. Check the [Azure pricing calculator](https://azure.microsoft.com/pricing/calculator/) — the database and the always-on replicas (`-MinReplicas 1`) are the main costs; use `-MinReplicas 0` to allow scale-to-zero (slower first request).
* **Production hardening (not done here):** private networking for the database (currently allows Azure services only), managed-identity image pulls instead of ACR admin credentials, Key Vault for secrets, custom domain + WAF. See "Known limitations".

## Tests

```bash
cd backend  && pytest -q          # 28 tests: auth, RBAC, booking conflicts, availability, AI, chart access
cd frontend && npm test           # 20 tests: every page renders for every role, route guards
```
CI (`.github/workflows/ci.yml`) runs both suites, builds the frontend and builds both Docker images on every push.

## AI methodology (scheduling only)

* **No-show risk** — RandomForest (200 trees, depth 8, balanced classes) trained on 6,000 *synthetic* appointments; stratified 80/20 split; accuracy ≈ 0.67, precision ≈ 0.43, recall ≈ 0.48, F1 ≈ 0.46 on synthetic test data — modest by design (the data is noisy). Features: age, prior appointments / no-shows / cancellations, lead time, weekday, hour. Computed from the patient's real history at booking time. Retrain: `cd ml && python generate_synthetic_data.py && python train_no_show_model.py`. The trained model is committed so every build ships it.
* **Visit categorisation** — transparent keyword rules (4 closed categories), chosen over ML so staff can audit why a booking was tagged.
* **Scheduling insights** — SQL aggregation (`GET /ai/scheduling-insights`).

## Known limitations (honest list)

No Alembic migrations (tables are created on start) · no refresh tokens or login rate limiting · no pagination on list endpoints · medical records are append-only · demo seeding is for demonstrations — **disable it (`SEED_DEMO_DATA=false`) for anything real** · the database firewall rule allows all Azure-hosted services (credentials still required) · tested here via API, jsdom page-render tests and bash/syntax checks; the Azure scripts could not be executed against a live subscription in the authoring environment, so expect to adjust a flag or region on first run.
