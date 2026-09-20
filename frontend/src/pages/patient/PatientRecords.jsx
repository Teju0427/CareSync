import { useEffect, useState } from "react";
import api from "../../api/client";

export default function PatientRecords() {
  const [patientId, setPatientId] = useState(null);
  const [records, setRecords] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);

  useEffect(() => {
    api.get("/patients/me").then((res) => setPatientId(res.data.id));
  }, []);

  useEffect(() => {
    if (!patientId) return;
    api.get(`/medical-records/${patientId}`).then((res) => setRecords(res.data));
    api.get(`/prescriptions/patient/${patientId}`).then((res) => setPrescriptions(res.data));
  }, [patientId]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Records &amp; prescriptions</h1>
          <p>Consultation notes and prescriptions your doctors have added.</p>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: "1.25rem" }}>
        <h3>Medical records</h3>
        {records.length === 0 ? (
          <div className="empty-state">No records yet — these appear after a completed visit.</div>
        ) : (
          records.map((r) => (
            <div key={r.id} style={{ borderBottom: "1px solid var(--color-line)", padding: "0.75rem 0" }}>
              <strong>{r.record_type.replace(/_/g, " ")}</strong>
              <p style={{ margin: "0.25em 0 0 0" }}>{r.notes}</p>
              <span style={{ fontSize: "0.8rem", color: "var(--color-muted)" }}>
                {new Date(r.created_at).toLocaleDateString()}
              </span>
            </div>
          ))
        )}
      </div>

      <div className="panel">
        <h3>Prescriptions</h3>
        {prescriptions.length === 0 ? (
          <div className="empty-state">No prescriptions yet.</div>
        ) : (
          prescriptions.map((p) => (
            <div key={p.id} style={{ borderBottom: "1px solid var(--color-line)", padding: "0.75rem 0" }}>
              {p.notes && <p style={{ margin: "0 0 0.5em 0" }}>{p.notes}</p>}
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
      </div>
    </div>
  );
}
