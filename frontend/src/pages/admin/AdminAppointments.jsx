import { useEffect, useMemo, useState } from "react";
import { Search, CalendarX2 } from "lucide-react";
import api, { errorMessage } from "../../api/client";
import { EmptyState, PageHeader, RiskBadge, SkeletonRows, StatusBadge } from "../../components/ui.jsx";
import { useToast } from "../../components/Toast.jsx";
import { CATEGORY_LABEL, STATUS_LABEL, formatDate, formatTime } from "../../utils";

export default function AdminAppointments() {
  const toast = useToast();
  const [appts, setAppts] = useState(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const load = () => api.get("/appointments").then((r) => setAppts(r.data));
  useEffect(() => { load(); }, []);

  const rows = useMemo(() => (appts || [])
    .filter((a) => (!status || a.status === status) && (!q || `${a.patient_name} ${a.doctor_name}`.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => (b.appointment_date + b.appointment_time).localeCompare(a.appointment_date + a.appointment_time)), [appts, q, status]);

  async function change(a, next) {
    try { await api.put(`/appointments/${a.id}/status`, { status: next }); toast.success("Status updated."); load(); }
    catch (e) { toast.error(errorMessage(e)); }
  }

  return (
    <>
      <PageHeader title="Appointments" subtitle="Every booking across the clinic. Change a status inline." />
      <div className="row wrap mb-2">
        <div className="search" style={{ minWidth: 260 }}><Search size={16} /><input className="input" placeholder="Search patient or doctor" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select className="select select-sm" style={{ height: 40, width: 180 }} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
          <option value="">All statuses</option>{Object.entries(STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <span className="muted small">{rows.length} result{rows.length === 1 ? "" : "s"}</span>
      </div>
      <div className="card card-flush">
        {!appts ? <SkeletonRows /> : rows.length === 0 ? <EmptyState icon={CalendarX2} title="No appointments found" text="Adjust the filters to see more." /> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Patient</th><th>Doctor</th><th>When</th><th>Type</th><th>Risk</th><th>Status</th></tr></thead>
            <tbody>{rows.map((a) => (
              <tr key={a.id}>
                <td><strong>{a.patient_name}</strong></td><td>{a.doctor_name}</td>
                <td className="nowrap">{formatDate(a.appointment_date, { day: "numeric", month: "short", year: "numeric" })}<div className="faint small">{formatTime(a.appointment_time)}</div></td>
                <td>{CATEGORY_LABEL[a.category] || "—"}</td>
                <td><RiskBadge score={a.no_show_risk_score} /></td>
                <td><div className="row"><StatusBadge status={a.status} />
                  <select className="select select-sm" value={a.status} onChange={(e) => change(a, e.target.value)} aria-label="Change status">
                    {Object.entries(STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </div>
    </>
  );
}
