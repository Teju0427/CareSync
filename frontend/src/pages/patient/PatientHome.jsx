import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarCheck, CheckCircle2, Pill, Stethoscope, ArrowRight, CalendarX2, Bell } from "lucide-react";
import api from "../../api/client";
import { useAuth } from "../../AuthContext.jsx";
import { Avatar, StatCard, StatusBadge, EmptyState, SkeletonRows } from "../../components/ui.jsx";
import { greeting, todayISO, relativeDay, formatTime, formatDate, CATEGORY_LABEL } from "../../utils";

export default function PatientHome() {
  const { user } = useAuth();
  const [appts, setAppts] = useState(null);
  const [rx, setRx] = useState([]);
  const [notes, setNotes] = useState([]);

  useEffect(() => {
    api.get("/appointments").then((r) => setAppts(r.data));
    api.get("/notifications").then((r) => setNotes(r.data.slice(0, 4)));
    api.get("/patients/me").then((p) => api.get(`/prescriptions/patient/${p.data.id}`)).then((r) => setRx(r.data)).catch(() => {});
  }, []);

  const today = todayISO();
  const upcoming = (appts || []).filter((a) => a.appointment_date >= today && ["scheduled", "confirmed"].includes(a.status))
    .sort((a, b) => (a.appointment_date + a.appointment_time).localeCompare(b.appointment_date + b.appointment_time));
  const next = upcoming[0];
  const completed = (appts || []).filter((a) => a.status === "completed").length;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>{greeting()}, {user.full_name.split(" ")[0]}</h1>
          <p>Here's a snapshot of your care.</p>
        </div>
        <Link to="/patient/find-doctors" className="btn btn-primary"><Stethoscope size={17} /> Book an appointment</Link>
      </div>

      <div className="stat-grid">
        <StatCard icon={CalendarCheck} tone="teal" label="Upcoming appointments" value={upcoming.length} loading={!appts} />
        <StatCard icon={CheckCircle2} tone="green" label="Completed visits" value={completed} loading={!appts} />
        <StatCard icon={Pill} tone="blue" label="Prescriptions on file" value={rx.length} loading={!appts} />
      </div>

      <div className="grid-2">
        <div className="stack">
          {!appts ? <div className="card"><SkeletonRows rows={2} height={90} /></div> : next ? (
            <div className="hero">
              <div className="small muted" style={{ textTransform: "uppercase", letterSpacing: ".06em", fontWeight: 600 }}>Your next appointment</div>
              <div className="row mt-2" style={{ gap: "1rem" }}>
                <Avatar name={next.doctor_name} size="lg" />
                <div className="grow">
                  <h2>{next.doctor_name}</h2>
                  <p className="muted">{CATEGORY_LABEL[next.category] || "Consultation"}</p>
                </div>
                <StatusBadge status={next.status} />
              </div>
              <div className="row wrap mt-2" style={{ gap: "1.5rem" }}>
                <div><div className="small muted">When</div><strong style={{ fontSize: "1.15rem" }}>{relativeDay(next.appointment_date)}, {formatTime(next.appointment_time)}</strong></div>
                <div><div className="small muted">Date</div><strong>{formatDate(next.appointment_date)}</strong></div>
              </div>
              <Link to="/patient/appointments" className="btn btn-secondary btn-sm mt-2">Manage appointment</Link>
            </div>
          ) : (
            <div className="card"><EmptyState icon={CalendarX2} title="Nothing scheduled" text="Find a doctor and pick a time that works for you." action={<Link to="/patient/find-doctors" className="btn btn-primary">Find a doctor</Link>} /></div>
          )}

          {upcoming.length > 1 && (
            <div className="card card-flush">
              <div className="card-head"><h3>Also coming up</h3><Link to="/patient/appointments" className="small">View all <ArrowRight size={13} style={{ verticalAlign: -2 }} /></Link></div>
              {upcoming.slice(1, 4).map((a) => (
                <div className="appt-card" key={a.id}>
                  <div className="date-block"><div className="mon">{formatDate(a.appointment_date, { month: "short" })}</div><div className="day">{a.appointment_date.slice(8)}</div></div>
                  <div className="grow"><strong>{a.doctor_name}</strong><div className="muted small">{formatTime(a.appointment_time)} · {CATEGORY_LABEL[a.category] || "Consultation"}</div></div>
                  <StatusBadge status={a.status} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card card-flush">
          <div className="card-head"><h3 className="row"><Bell size={17} /> Recent activity</h3><Link to="/patient/notifications" className="small">All</Link></div>
          {notes.length === 0 ? <EmptyState title="No activity yet" text="Updates about your bookings will show here." /> : notes.map((n) => (
            <div key={n.id} className={`list-item ${n.is_read ? "" : "unread"}`}>
              {!n.is_read && <span className="dot" />}
              <p className="small">{n.message}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
