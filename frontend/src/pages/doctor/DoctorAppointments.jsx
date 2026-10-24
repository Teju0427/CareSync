import { useEffect, useMemo, useState } from "react";
import { Search, CalendarX2 } from "lucide-react";
import api from "../../api/client";
import { Avatar, EmptyState, PageHeader, RiskBadge, SkeletonRows, StatusBadge, Tabs } from "../../components/ui.jsx";
import ConsultationModal from "../../components/ConsultationModal.jsx";
import { CATEGORY_LABEL, formatDate, formatTime, todayISO } from "../../utils";

export default function DoctorAppointments() {
  const [appts, setAppts] = useState(null);
  const [tab, setTab] = useState("upcoming");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(null);
  const load = () => api.get("/appointments").then((r) => setAppts(r.data));
  useEffect(() => { load(); }, []);

  const today = todayISO();
  const key = (a) => a.appointment_date + a.appointment_time;
  const groups = useMemo(() => {
    const l = (appts || []).filter((a) => !q || a.patient_name.toLowerCase().includes(q.toLowerCase()));
    return {
      upcoming: l.filter((a) => a.appointment_date >= today && ["scheduled", "confirmed"].includes(a.status)).sort((a, b) => key(a).localeCompare(key(b))),
      past: l.filter((a) => a.status === "completed" || a.status === "no_show" || (a.appointment_date < today && a.status !== "cancelled")).sort((a, b) => key(b).localeCompare(key(a))),
      cancelled: l.filter((a) => a.status === "cancelled").sort((a, b) => key(b).localeCompare(key(a))),
    };
  }, [appts, q, today]);
  const rows = groups[tab];

  return (
    <>
      <PageHeader title="All appointments" subtitle="Open any appointment to review it, add notes or prescribe." />
      <div className="search mb-2" style={{ maxWidth: 360 }}><Search size={16} /><input className="input" placeholder="Search by patient name" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <Tabs value={tab} onChange={setTab} tabs={[
        { id: "upcoming", label: "Upcoming", count: groups.upcoming.length },
        { id: "past", label: "Past", count: groups.past.length },
        { id: "cancelled", label: "Cancelled", count: groups.cancelled.length },
      ]} />
      <div className="card card-flush">
        {!appts ? <SkeletonRows /> : rows.length === 0 ? <EmptyState icon={CalendarX2} title="Nothing here" text="No appointments match this view." /> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Patient</th><th>When</th><th>Type</th><th>No-show risk</th><th>Status</th></tr></thead>
            <tbody>{rows.map((a) => (
              <tr key={a.id} onClick={() => setOpen(a)} style={{ cursor: "pointer" }}>
                <td><div className="row"><Avatar name={a.patient_name} size="sm" /><strong>{a.patient_name}</strong></div></td>
                <td className="nowrap">{formatDate(a.appointment_date, { day: "numeric", month: "short", year: "numeric" })}<div className="faint small">{formatTime(a.appointment_time)}</div></td>
                <td>{CATEGORY_LABEL[a.category] || "—"}</td>
                <td><RiskBadge score={a.no_show_risk_score} /></td>
                <td><StatusBadge status={a.status} /></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </div>
      {open && <ConsultationModal appt={open} onClose={() => setOpen(null)} onChanged={load} />}
    </>
  );
}
