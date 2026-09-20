import { useEffect, useState } from "react";
import api from "../../api/client";
import StatusPill from "../../components/StatusPill.jsx";

const STATUS_OPTIONS = ["scheduled", "confirmed", "completed", "cancelled", "no_show"];

export default function DoctorHome() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [noteDraft, setNoteDraft] = useState({});
  const [rxDraft, setRxDraft] = useState({});
  const [openRx, setOpenRx] = useState(null);

  function load() {
    setLoading(true);
    api.get("/appointments").then((res) => setAppointments(res.data)).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function updateStatus(id, status) {
    await api.put(`/appointments/${id}/status`, { status });
    load();
  }

  async function saveNotes(id) {
    await api.put(`/appointments/${id}/notes`, { consultation_notes: noteDraft[id] || "" });
    load();
  }

  async function submitPrescription(appointmentId) {
    const items = rxDraft[appointmentId] || [];
    if (items.length === 0) return;
    await api.post("/prescriptions", { appointment_id: appointmentId, items });
    setOpenRx(null);
    setRxDraft({ ...rxDraft, [appointmentId]: [] });
  }

  function addRxItem(appointmentId) {
    const current = rxDraft[appointmentId] || [];
    setRxDraft({
      ...rxDraft,
      [appointmentId]: [...current, { medicine_name: "", dosage: "", frequency: "", duration_days: 5, instructions: "" }],
    });
  }

  function updateRxItem(appointmentId, idx, field, value) {
    const current = [...(rxDraft[appointmentId] || [])];
    current[idx] = { ...current[idx], [field]: value };
    setRxDraft({ ...rxDraft, [appointmentId]: current });
  }

  const today = new Date().toISOString().slice(0, 10);
  const todays = appointments.filter((a) => a.appointment_date === today);
  const upcoming = appointments.filter((a) => a.appointment_date > today);

  function AppointmentCard({ a }) {
    return (
      <div className="panel" style={{ marginBottom: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
          <div>
            <strong>{a.patient_name}</strong>
            <div style={{ color: "var(--color-muted)", fontSize: "0.9rem" }}>
              {a.appointment_date} at {a.appointment_time} · {a.category?.replace(/_/g, " ") || "general consultation"}
            </div>
            {a.reason && <p style={{ margin: "0.4em 0 0 0" }}>{a.reason}</p>}
            {a.no_show_risk_score != null && (
              <div style={{ fontSize: "0.85rem", color: "var(--color-accent)" }}>
                No-show risk: {(a.no_show_risk_score * 100).toFixed(0)}%
              </div>
            )}
          </div>
          <StatusPill status={a.status} />
        </div>

        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.75rem" }}>
          <select value={a.status} onChange={(e) => updateStatus(a.id, e.target.value)}>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
          </select>
          <button className="btn btn-secondary" onClick={() => setOpenRx(openRx === a.id ? null : a.id)}>
            {openRx === a.id ? "Close prescription" : "Add prescription"}
          </button>
        </div>

        <div className="field" style={{ marginTop: "0.75rem" }}>
          <label>Consultation notes</label>
          <textarea
            defaultValue={a.consultation_notes || ""}
            onChange={(e) => setNoteDraft({ ...noteDraft, [a.id]: e.target.value })}
          />
          <button className="btn btn-secondary" style={{ alignSelf: "flex-start" }} onClick={() => saveNotes(a.id)}>
            Save notes
          </button>
        </div>

        {openRx === a.id && (
          <div style={{ borderTop: "1px solid var(--color-line)", marginTop: "0.75rem", paddingTop: "0.75rem" }}>
            {(rxDraft[a.id] || []).map((item, idx) => (
              <div key={idx} style={{ display: "flex", gap: "0.4rem", marginBottom: "0.4rem", flexWrap: "wrap" }}>
                <input placeholder="Medicine" value={item.medicine_name} onChange={(e) => updateRxItem(a.id, idx, "medicine_name", e.target.value)} />
                <input placeholder="Dosage" value={item.dosage} onChange={(e) => updateRxItem(a.id, idx, "dosage", e.target.value)} />
                <input placeholder="Frequency" value={item.frequency} onChange={(e) => updateRxItem(a.id, idx, "frequency", e.target.value)} />
                <input type="number" placeholder="Days" value={item.duration_days} onChange={(e) => updateRxItem(a.id, idx, "duration_days", Number(e.target.value))} style={{ width: "70px" }} />
              </div>
            ))}
            <button className="btn btn-secondary" onClick={() => addRxItem(a.id)}>+ Add medicine</button>
            <button className="btn btn-primary" style={{ marginLeft: "0.5rem" }} onClick={() => submitPrescription(a.id)}>
              Save prescription
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Today's schedule</h1>
          <p>{today}</p>
        </div>
      </div>

      {loading ? <p>Loading…</p> : (
        <>
          {todays.length === 0 ? (
            <div className="empty-state">No appointments today.</div>
          ) : (
            todays.map((a) => <AppointmentCard key={a.id} a={a} />)
          )}

          <h2 style={{ marginTop: "2rem" }}>Upcoming</h2>
          {upcoming.length === 0 ? (
            <div className="empty-state">Nothing further scheduled yet.</div>
          ) : (
            upcoming.slice(0, 10).map((a) => <AppointmentCard key={a.id} a={a} />)
          )}
        </>
      )}
    </div>
  );
}
