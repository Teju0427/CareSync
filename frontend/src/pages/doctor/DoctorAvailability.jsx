import { useEffect, useState } from "react";
import api from "../../api/client";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function DoctorAvailability() {
  const [doctorId, setDoctorId] = useState(null);
  const [slots, setSlots] = useState([]);
  const [form, setForm] = useState({ day_of_week: 0, start_time: "09:00", end_time: "13:00", slot_duration_minutes: 30 });
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    api.get("/doctors/me").then((res) => setDoctorId(res.data.id));
  }, []);

  function load(id) {
    api.get(`/doctors/${id}/availability`).then((res) =>
      setSlots([...res.data].sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time)))
    );
  }

  useEffect(() => {
    if (doctorId) load(doctorId);
  }, [doctorId]);

  async function addSlot(e) {
    e.preventDefault();
    setError("");
    if (form.end_time <= form.start_time) {
      setError("End time must be after start time.");
      return;
    }
    try {
      await api.post(`/doctors/${doctorId}/availability`, form);
      load(doctorId);
    } catch (err) {
      setError(err.response?.data?.detail || "Could not add that block.");
    }
  }

  async function removeSlot(slotId) {
    setDeletingId(slotId);
    try {
      await api.delete(`/doctors/${doctorId}/availability/${slotId}`);
      load(doctorId);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Weekly availability</h1>
          <p>Set recurring blocks patients can book into. Slots repeat every week.</p>
        </div>
      </div>

      <div className="two-col">
        <div className="panel">
          <h3>Current blocks</h3>
          {slots.length === 0 ? (
            <div className="empty-state">No availability set yet.</div>
          ) : (
            <table>
              <thead><tr><th>Day</th><th>Start</th><th>End</th><th>Slot length</th><th></th></tr></thead>
              <tbody>
                {slots.map((s) => (
                  <tr key={s.id}>
                    <td>{DAYS[s.day_of_week]}</td>
                    <td>{s.start_time.slice(0, 5)}</td>
                    <td>{s.end_time.slice(0, 5)}</td>
                    <td>{s.slot_duration_minutes} min</td>
                    <td>
                      <button
                        className="btn btn-danger"
                        onClick={() => removeSlot(s.id)}
                        disabled={deletingId === s.id}
                      >
                        {deletingId === s.id ? "Removing…" : "Delete"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <form className="panel" onSubmit={addSlot}>
          <h3>Add a block</h3>
          <div className="field">
            <label>Day of week</label>
            <select value={form.day_of_week} onChange={(e) => setForm({ ...form, day_of_week: Number(e.target.value) })}>
              {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Start time</label>
            <input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
          </div>
          <div className="field">
            <label>End time</label>
            <input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
          </div>
          <div className="field">
            <label>Slot length (minutes)</label>
            <select
              value={form.slot_duration_minutes}
              onChange={(e) => setForm({ ...form, slot_duration_minutes: Number(e.target.value) })}
            >
              {[15, 20, 30, 45, 60].map((m) => <option key={m} value={m}>{m} minutes</option>)}
            </select>
          </div>
          {error && <p className="error-text">{error}</p>}
          <button className="btn btn-primary" type="submit" disabled={!doctorId}>Add block</button>
        </form>
      </div>
    </div>
  );
}
