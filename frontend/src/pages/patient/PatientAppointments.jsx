import { useEffect, useState } from "react";
import api from "../../api/client";
import StatusPill from "../../components/StatusPill.jsx";

export default function PatientAppointments() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rescheduling, setRescheduling] = useState(null);
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");

  function load() {
    setLoading(true);
    api.get("/appointments").then((res) => setAppointments(res.data)).finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function cancel(id) {
    await api.put(`/appointments/${id}/cancel`);
    load();
  }

  async function submitReschedule(id) {
    await api.put(`/appointments/${id}/reschedule`, {
      appointment_date: newDate,
      appointment_time: newTime,
    });
    setRescheduling(null);
    load();
  }

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = appointments.filter((a) => a.appointment_date >= today && a.status !== "cancelled");
  const history = appointments.filter((a) => a.appointment_date < today || a.status === "cancelled");

  function renderRow(a) {
    const canManage = a.status === "scheduled" || a.status === "confirmed";
    return (
      <tr key={a.id}>
        <td>{a.doctor_name}</td>
        <td>{a.appointment_date}</td>
        <td>{a.appointment_time}</td>
        <td><StatusPill status={a.status} /></td>
        <td>{a.category?.replace(/_/g, " ") || "—"}</td>
        <td>
          {canManage && rescheduling !== a.id && (
            <div style={{ display: "flex", gap: "0.4rem" }}>
              <button className="btn btn-secondary" onClick={() => { setRescheduling(a.id); setNewDate(a.appointment_date); setNewTime(a.appointment_time); }}>
                Reschedule
              </button>
              <button className="btn btn-danger" onClick={() => cancel(a.id)}>Cancel</button>
            </div>
          )}
          {rescheduling === a.id && (
            <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
              <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
              <input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} />
              <button className="btn btn-primary" onClick={() => submitReschedule(a.id)}>Save</button>
              <button className="btn btn-secondary" onClick={() => setRescheduling(null)}>Cancel</button>
            </div>
          )}
        </td>
      </tr>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Your appointments</h1>
          <p>Manage upcoming visits and review your appointment history.</p>
        </div>
      </div>

      {loading ? <p>Loading…</p> : (
        <>
          <div className="panel" style={{ marginBottom: "1.25rem" }}>
            <h3>Upcoming</h3>
            {upcoming.length === 0 ? (
              <div className="empty-state">Nothing scheduled — book a visit from Find a doctor.</div>
            ) : (
              <table>
                <thead><tr><th>Doctor</th><th>Date</th><th>Time</th><th>Status</th><th>Category</th><th></th></tr></thead>
                <tbody>{upcoming.map(renderRow)}</tbody>
              </table>
            )}
          </div>

          <div className="panel">
            <h3>History</h3>
            {history.length === 0 ? (
              <div className="empty-state">No past appointments yet.</div>
            ) : (
              <table>
                <thead><tr><th>Doctor</th><th>Date</th><th>Time</th><th>Status</th><th>Category</th><th></th></tr></thead>
                <tbody>{history.map(renderRow)}</tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
