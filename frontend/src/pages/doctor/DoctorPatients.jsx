import { useEffect, useState } from "react";
import api from "../../api/client";
import StatusPill from "../../components/StatusPill.jsx";

function calcAge(dob) {
  if (!dob) return null;
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const hasHadBirthdayThisYear =
    today.getMonth() > birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate());
  if (!hasHadBirthdayThisYear) age -= 1;
  return age;
}

export default function DoctorPatients() {
  const [appointments, setAppointments] = useState([]);
  const [selected, setSelected] = useState(null);
  const [profile, setProfile] = useState(null);
  const [records, setRecords] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [noteForm, setNoteForm] = useState({ record_type: "consultation_summary", notes: "" });
  const [noteError, setNoteError] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  useEffect(() => {
    api.get("/appointments").then((res) => setAppointments(res.data));
  }, []);

  const patientMap = new Map();
  appointments.forEach((a) => {
    if (!patientMap.has(a.patient_id)) {
      patientMap.set(a.patient_id, { id: a.patient_id, name: a.patient_name, visits: [] });
    }
    patientMap.get(a.patient_id).visits.push(a);
  });
  const patients = Array.from(patientMap.values());
  const activePatient = patients.find((p) => p.id === selected);

  function loadPatientChart(patientId) {
    setSelected(patientId);
    setDetailLoading(true);
    Promise.all([
      api.get(`/patients/${patientId}`),
      api.get(`/medical-records/${patientId}`),
      api.get(`/prescriptions/patient/${patientId}`),
    ])
      .then(([p, r, rx]) => {
        setProfile(p.data);
        setRecords(r.data);
        setPrescriptions(rx.data);
      })
      .finally(() => setDetailLoading(false));
  }

  async function submitNote(e) {
    e.preventDefault();
    setNoteError("");
    if (!noteForm.notes.trim()) {
      setNoteError("Add a note before saving.");
      return;
    }
    setSavingNote(true);
    try {
      await api.post("/medical-records", { patient_id: selected, ...noteForm });
      const res = await api.get(`/medical-records/${selected}`);
      setRecords(res.data);
      setNoteForm({ record_type: "consultation_summary", notes: "" });
    } catch (err) {
      setNoteError(err.response?.data?.detail || "Could not save that note.");
    } finally {
      setSavingNote(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>My patients</h1>
          <p>Everyone who has an appointment with you.</p>
        </div>
      </div>

      <div className="two-col">
        <div className="panel">
          {patients.length === 0 ? (
            <div className="empty-state">No patients yet.</div>
          ) : (
            <table>
              <thead><tr><th>Patient</th><th>Visits</th><th></th></tr></thead>
              <tbody>
                {patients.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>{p.visits.length}</td>
                    <td><button className="btn btn-secondary" onClick={() => loadPatientChart(p.id)}>View chart</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="panel">
          {!selected ? (
            <p>Select a patient to see their full chart — profile, visit history, medical records, and prescriptions.</p>
          ) : detailLoading ? (
            <p>Loading chart…</p>
          ) : (
            <>
              <h3>{activePatient?.name}</h3>
              {profile && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem 1.2rem", marginBottom: "1rem", fontSize: "0.9rem", color: "var(--color-muted)" }}>
                  {calcAge(profile.date_of_birth) != null && <span>Age {calcAge(profile.date_of_birth)}</span>}
                  {profile.gender && <span>{profile.gender}</span>}
                  {profile.blood_group && <span>Blood group {profile.blood_group}</span>}
                  {profile.emergency_contact && <span>Emergency contact: {profile.emergency_contact}</span>}
                  {!profile.date_of_birth && !profile.gender && !profile.blood_group && !profile.emergency_contact && (
                    <span>No demographic details on file yet.</span>
                  )}
                </div>
              )}

              <h3 style={{ fontSize: "1rem", marginTop: "1.2rem" }}>Visit history with you</h3>
              {activePatient?.visits.map((v) => (
                <div key={v.id} style={{ borderBottom: "1px solid var(--color-line)", padding: "0.5rem 0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>{v.appointment_date} · {v.appointment_time}</span>
                    <StatusPill status={v.status} />
                  </div>
                  {v.consultation_notes && <p style={{ margin: "0.3em 0 0 0", fontSize: "0.9rem" }}>{v.consultation_notes}</p>}
                </div>
              ))}

              <h3 style={{ fontSize: "1rem", marginTop: "1.2rem" }}>Medical records</h3>
              {records.length === 0 ? (
                <p style={{ color: "var(--color-muted)", fontSize: "0.9rem" }}>No records yet.</p>
              ) : (
                records.map((r) => (
                  <div key={r.id} style={{ borderBottom: "1px solid var(--color-line)", padding: "0.5rem 0" }}>
                    <strong style={{ fontSize: "0.85rem" }}>{r.record_type.replace(/_/g, " ")}</strong>
                    <p style={{ margin: "0.2em 0 0 0", fontSize: "0.9rem" }}>{r.notes}</p>
                    <span style={{ fontSize: "0.78rem", color: "var(--color-muted)" }}>
                      {new Date(r.created_at).toLocaleDateString()}
                    </span>
                  </div>
                ))
              )}

              <form onSubmit={submitNote} style={{ marginTop: "0.75rem" }}>
                <div className="field">
                  <label>Add a note to this patient's chart</label>
                  <select value={noteForm.record_type} onChange={(e) => setNoteForm({ ...noteForm, record_type: e.target.value })}>
                    <option value="consultation_summary">Consultation summary</option>
                    <option value="lab_result">Lab result</option>
                    <option value="referral">Referral</option>
                    <option value="general_note">General note</option>
                  </select>
                  <textarea
                    placeholder="What should future visits know about this patient?"
                    value={noteForm.notes}
                    onChange={(e) => setNoteForm({ ...noteForm, notes: e.target.value })}
                  />
                </div>
                {noteError && <p className="error-text">{noteError}</p>}
                <button className="btn btn-secondary" type="submit" disabled={savingNote}>
                  {savingNote ? "Saving…" : "Save note"}
                </button>
              </form>

              <h3 style={{ fontSize: "1rem", marginTop: "1.2rem" }}>Prescriptions</h3>
              {prescriptions.length === 0 ? (
                <p style={{ color: "var(--color-muted)", fontSize: "0.9rem" }}>No prescriptions yet.</p>
              ) : (
                prescriptions.map((p) => (
                  <div key={p.id} style={{ borderBottom: "1px solid var(--color-line)", padding: "0.5rem 0" }}>
                    {p.notes && <p style={{ margin: "0 0 0.4em 0", fontSize: "0.9rem" }}>{p.notes}</p>}
                    <table>
                      <thead><tr><th>Medicine</th><th>Dosage</th><th>Frequency</th><th>Duration</th></tr></thead>
                      <tbody>
                        {p.items.map((item) => (
                          <tr key={item.id}>
                            <td>{item.medicine_name}</td>
                            <td>{item.dosage}</td>
                            <td>{item.frequency}</td>
                            <td>{item.duration_days} days</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
