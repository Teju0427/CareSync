import { useEffect, useState } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import api from "../../api/client";

export default function AdminHome() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get("/admin/dashboard").then((res) => setData(res.data));
  }, []);

  if (!data) return <p>Loading dashboard…</p>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Clinic overview</h1>
          <p>Live snapshot of patients, doctors, and appointment activity.</p>
        </div>
      </div>

      <div className="kpi-row">
        <div className="kpi-card"><div className="kpi-value">{data.total_patients}</div><div className="kpi-label">Total patients</div></div>
        <div className="kpi-card"><div className="kpi-value">{data.total_doctors}</div><div className="kpi-label">Total doctors</div></div>
        <div className="kpi-card"><div className="kpi-value">{data.todays_appointments}</div><div className="kpi-label">Today's appointments</div></div>
        <div className="kpi-card"><div className="kpi-value">{data.completed_appointments}</div><div className="kpi-label">Completed</div></div>
        <div className="kpi-card"><div className="kpi-value">{data.cancelled_appointments}</div><div className="kpi-label">Cancelled</div></div>
        <div className="kpi-card"><div className="kpi-value">{data.no_show_appointments}</div><div className="kpi-label">No-shows</div></div>
      </div>

      <div className="two-col">
        <div className="panel">
          <h3>Appointment trend (last 14 days)</h3>
          {data.appointment_trend.length === 0 ? (
            <div className="empty-state">No appointment activity in this window yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={data.appointment_trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#114b46" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="panel">
          <h3>Appointments by department</h3>
          {data.department_stats.length === 0 ? (
            <div className="empty-state">No department activity yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.department_stats}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" />
                <XAxis dataKey="department" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="appointment_count" fill="#b8863b" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
