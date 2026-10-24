import { useEffect, useState } from "react";
import { CalendarClock, Users, ShieldAlert, CheckCircle2, CalendarX2, ChevronRight } from "lucide-react";
import api from "../../api/client";
import { useAuth } from "../../AuthContext.jsx";
import { Avatar, EmptyState, PageHeader, RiskBadge, SkeletonRows, StatCard, StatusBadge } from "../../components/ui.jsx";
import ConsultationModal from "../../components/ConsultationModal.jsx";
import { CATEGORY_LABEL, formatDate, formatTime, greeting, relativeDay, riskLevel, todayISO } from "../../utils";

export default function DoctorHome() {
  const { user } = useAuth();
  const [appts, setAppts] = useState(null);
  const [open, setOpen] = useState(null);
  const load = () => api.get("/appointments").then((r) => setAppts(r.data));
  useEffect(() => { load(); }, []);

  const today = todayISO();
  const key = (a) => a.appointment_date + a.appointment_time;
  const list = appts || [];
  const todays = list.filter((a) => a.appointment_date === today).sort((a, b) => key(a).localeCompare(key(b)));
  const upcoming = list.filter((a) => a.appointment_date > today && ["scheduled", "confirmed"].includes(a.status)).sort((a, b) => key(a).localeCompare(key(b)));
  const remaining = todays.filter((a) => ["scheduled", "confirmed"].includes(a.status)).length;
  const done = todays.filter((a) => a.status === "completed").length;
  const highRisk = todays.filter((a) => ["scheduled", "confirmed"].includes(a.status) && riskLevel(a.no_show_risk_score) === "high").length;
  const patients = new Set(list.map((a) => a.patient_id)).size;

  const Row = ({ a, showDate }) => (
    <button className="appt-card" style={{ width: "100%", background: "none", border: "none", borderBottom: "1px solid var(--line)", textAlign: "left", cursor: "pointer" }} onClick={() => setOpen(a)}>
      <div style={{ width: 70 }}>
        <strong>{formatTime(a.appointment_time)}</strong>
        {showDate && <div className="faint small">{formatDate(a.appointment_date, { day: "numeric", month: "short" })}</div>}
      </div>
      <Avatar name={a.patient_name} size="sm" />
      <div className="grow">
        <strong>{a.patient_name}</strong>
        <div className="muted small">{CATEGORY_LABEL[a.category] || "Consultation"}{a.reason ? ` · ${a.reason}` : ""}</div>
      </div>
      <div className="row wrap" style={{ justifyContent: "flex-end" }}>
        {["scheduled", "confirmed"].includes(a.status) && <RiskBadge score={a.no_show_risk_score} />}
        <StatusBadge status={a.status} />
        <ChevronRight size={16} className="faint" />
      </div>
    </button>
  );

  return (
    <>
      <PageHeader title={`${greeting()}, ${user.full_name.replace(/^Dr\.?\s+/i, "Dr. ").split(" ").slice(0, 2).join(" ")}`} subtitle={`${relativeDay(today)} · ${formatDate(today, { day: "numeric", month: "long", year: "numeric" })}`} />
      <div className="stat-grid">
        <StatCard icon={CalendarClock} tone="teal" label="Still to see today" value={remaining} loading={!appts} />
        <StatCard icon={CheckCircle2} tone="green" label="Completed today" value={done} loading={!appts} />
        <StatCard icon={ShieldAlert} tone="red" label="High no-show risk today" value={highRisk} loading={!appts} />
        <StatCard icon={Users} tone="blue" label="Patients under your care" value={patients} loading={!appts} />
      </div>

      <div className="card card-flush mb-3">
        <div className="card-head"><h3>Today's schedule</h3><span className="muted small">{todays.length} appointment{todays.length === 1 ? "" : "s"}</span></div>
        {!appts ? <SkeletonRows /> : todays.length === 0 ? <EmptyState icon={CalendarX2} title="A clear day" text="No appointments are booked for today." /> : todays.map((a) => <Row key={a.id} a={a} />)}
      </div>

      <div className="card card-flush">
        <div className="card-head"><h3>Coming up</h3></div>
        {!appts ? <SkeletonRows rows={2} /> : upcoming.length === 0 ? <EmptyState title="Nothing further booked" text="New bookings will appear here." /> : upcoming.slice(0, 8).map((a) => <Row key={a.id} a={a} showDate />)}
      </div>

      {open && <ConsultationModal appt={open} onClose={() => setOpen(null)} onChanged={load} />}
    </>
  );
}
