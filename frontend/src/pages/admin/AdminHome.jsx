import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Users, Stethoscope, CalendarDays, CheckCircle2, XCircle, UserX, TrendingUp, CalendarClock } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import api from "../../api/client";
import { EmptyState, PageHeader, RiskBadge, StatCard, StatusBadge } from "../../components/ui.jsx";
import { formatDate, formatTime, STATUS_LABEL } from "../../utils";

const STATUS_COLOR = { scheduled: "#2563eb", confirmed: "#0f766e", completed: "#15803d", cancelled: "#94a3b8", no_show: "#b91c1c" };
const axis = { fontSize: 11, fill: "#5b6b7b" };

export default function AdminHome() {
  const [d, setD] = useState(null);
  useEffect(() => { api.get("/admin/dashboard").then((r) => setD(r.data)); }, []);
  const L = !d;
  const v = (k) => (d ? d[k] : 0);
  const trend = (d?.appointment_trend || []).map((t) => ({ ...t, label: formatDate(t.date, { day: "numeric", month: "short" }) }));
  const status = (d?.status_breakdown || []).map((s) => ({ name: STATUS_LABEL[s.status], key: s.status, value: s.count }));
  const maxUtil = Math.max(1, ...(d?.doctor_utilization || []).map((x) => x.appointments));

  return (
    <>
      <PageHeader title="Clinic overview" subtitle="A live view of patients, doctors and appointment activity." />
      <div className="stat-grid">
        <StatCard icon={Users} tone="blue" label="Patients" value={v("total_patients")} loading={L} />
        <StatCard icon={Stethoscope} tone="teal" label="Doctors" value={v("total_doctors")} loading={L} />
        <StatCard icon={CalendarDays} tone="amber" label="Today's appointments" value={v("todays_appointments")} loading={L} />
        <StatCard icon={CalendarClock} tone="blue" label="Upcoming" value={v("upcoming_appointments")} loading={L} />
        <StatCard icon={CheckCircle2} tone="green" label="Completed" value={v("completed_appointments")} loading={L} />
        <StatCard icon={XCircle} tone="slate" label="Cancelled" value={v("cancelled_appointments")} loading={L} />
        <StatCard icon={UserX} tone="red" label="No-shows" value={v("no_show_appointments")} loading={L} />
        <StatCard icon={TrendingUp} tone="red" label="No-show rate" value={`${Math.round(v("no_show_rate") * 100)}%`} loading={L} />
      </div>

      <div className="grid-2 mb-3">
        <div className="card">
          <div className="card-head"><h3>Appointments · 14-day window</h3><span className="muted small">7 days back, 6 ahead</span></div>
          <div className="card-body" style={{ height: 290 }}>
            {L ? <div className="skeleton" style={{ height: "100%" }} /> : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend} margin={{ left: -20, right: 8, top: 8 }}>
                  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0f766e" stopOpacity={0.28} /><stop offset="100%" stopColor="#0f766e" stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid stroke="#e2e8ee" vertical={false} />
                  <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} interval={1} />
                  <YAxis allowDecimals={false} tick={axis} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8ee", fontSize: 12 }} />
                  <Area type="monotone" dataKey="count" name="Appointments" stroke="#0f766e" strokeWidth={2.4} fill="url(#g)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
        <div className="card">
          <div className="card-head"><h3>By status</h3><span className="muted small">{v("total_appointments")} total</span></div>
          <div className="card-body" style={{ height: 290 }}>
            {L ? <div className="skeleton" style={{ height: "100%" }} /> : status.length === 0 ? <EmptyState title="No appointments yet" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={status} dataKey="value" nameKey="name" innerRadius={62} outerRadius={92} paddingAngle={2} stroke="none">
                    {status.map((s) => <Cell key={s.key} fill={STATUS_COLOR[s.key]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8ee", fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
            <div className="row wrap" style={{ justifyContent: "center", gap: ".4rem 1rem", marginTop: -6 }}>
              {status.map((s) => <span key={s.key} className="small muted row" style={{ gap: 6 }}><span style={{ width: 9, height: 9, borderRadius: 3, background: STATUS_COLOR[s.key] }} />{s.name} {s.value}</span>)}
            </div>
          </div>
        </div>
      </div>

      <div className="grid-2-even mb-3">
        <div className="card">
          <div className="card-head"><h3>Appointments by department</h3></div>
          <div className="card-body" style={{ height: 260 }}>
            {L ? <div className="skeleton" style={{ height: "100%" }} /> : d.department_stats.length === 0 ? <EmptyState title="No department activity yet" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={d.department_stats} layout="vertical" margin={{ left: 20, right: 12 }}>
                  <CartesianGrid stroke="#e2e8ee" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={axis} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="department" tick={axis} tickLine={false} axisLine={false} width={110} />
                  <Tooltip cursor={{ fill: "#f3f6f9" }} contentStyle={{ borderRadius: 8, border: "1px solid #e2e8ee", fontSize: 12 }} />
                  <Bar dataKey="appointment_count" name="Appointments" fill="#0f766e" radius={[0, 5, 5, 0]} barSize={18} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
        <div className="card">
          <div className="card-head"><h3>Doctor utilisation</h3><span className="muted small">Appointments booked</span></div>
          <div className="card-body">
            {L ? <div className="skeleton" style={{ height: 180 }} /> : d.doctor_utilization.length === 0 ? <EmptyState title="No bookings yet" /> : d.doctor_utilization.map((u) => (
              <div key={u.doctor} style={{ marginBottom: ".9rem" }}>
                <div className="row-between small"><span><strong>{u.doctor}</strong> <span className="faint">· {u.specialization}</span></span><strong>{u.appointments}</strong></div>
                <div className="progress mt-1"><span style={{ width: `${(u.appointments / maxUtil) * 100}%` }} /></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card card-flush">
        <div className="card-head"><h3>Recent bookings</h3><Link to="/admin/appointments" className="small">View all</Link></div>
        {L ? <div className="skeleton" style={{ height: 120, margin: "1rem" }} /> : d.recent_appointments.length === 0 ? <EmptyState title="No bookings yet" /> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Patient</th><th>Doctor</th><th>When</th><th>No-show risk</th><th>Status</th></tr></thead>
            <tbody>{d.recent_appointments.map((a) => (
              <tr key={a.id}><td><strong>{a.patient}</strong></td><td>{a.doctor}</td><td className="nowrap">{formatDate(a.date, { day: "numeric", month: "short" })} · {formatTime(a.time)}</td><td><RiskBadge score={a.risk} /></td><td><StatusBadge status={a.status} /></td></tr>
            ))}</tbody>
          </table></div>
        )}
      </div>
    </>
  );
}
