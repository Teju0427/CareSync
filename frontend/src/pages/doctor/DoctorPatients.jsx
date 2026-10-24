import { useEffect, useMemo, useState } from "react";
import { Search, Users, FileText, Pill, CalendarDays, Plus } from "lucide-react";
import api, { errorMessage } from "../../api/client";
import { Avatar, EmptyState, Modal, PageHeader, SkeletonRows, StatusBadge, Tabs } from "../../components/ui.jsx";
import { useToast } from "../../components/Toast.jsx";
import { calcAge, formatDate, formatTime } from "../../utils";

const NOTE_TYPES = [["consultation_summary", "Consultation summary"], ["lab_result", "Lab result"], ["referral", "Referral"], ["general_note", "General note"]];

function Chart({ patient, onClose }) {
  const toast = useToast();
  const [tab, setTab] = useState("overview");
  const [profile, setProfile] = useState(null);
  const [records, setRecords] = useState([]);
  const [rx, setRx] = useState([]);
  const [error, setError] = useState("");
  const [note, setNote] = useState({ record_type: "consultation_summary", notes: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([api.get(`/patients/${patient.id}`), api.get(`/medical-records/${patient.id}`), api.get(`/prescriptions/patient/${patient.id}`)])
      .then(([p, r, x]) => { setProfile(p.data); setRecords(r.data); setRx(x.data); })
      .catch((e) => setError(errorMessage(e)));
  }, [patient.id]);

  async function addNote(e) {
    e.preventDefault();
    if (!note.notes.trim()) return;
    setBusy(true);
    try {
      await api.post("/medical-records", { patient_id: patient.id, ...note });
      setRecords((await api.get(`/medical-records/${patient.id}`)).data);
      setNote({ record_type: "consultation_summary", notes: "" }); toast.success("Note added to chart.");
    } catch (err) { toast.error(errorMessage(err)); } finally { setBusy(false); }
  }

  const age = profile && calcAge(profile.date_of_birth);
  return (
    <Modal drawer title={patient.name} subtitle="Patient chart" onClose={onClose}>
      {error ? <p className="form-error">{error}</p> : !profile ? <SkeletonRows rows={4} /> : (
        <>
          <div className="row" style={{ gap: "1rem" }}>
            <Avatar name={patient.name} size="lg" />
            <div className="muted small">{age != null ? `${age} years` : "Age not recorded"}{profile.gender ? ` · ${profile.gender}` : ""}{profile.blood_group ? ` · Blood group ${profile.blood_group}` : ""}</div>
          </div>
          <div className="mt-2" />
          <Tabs value={tab} onChange={setTab} tabs={[
            { id: "overview", label: "Overview" }, { id: "visits", label: "Visits", count: patient.visits.length },
            { id: "records", label: "Records", count: records.length }, { id: "rx", label: "Prescriptions", count: rx.length },
          ]} />
          {tab === "overview" && (
            <dl className="kv">
              <dt>Email</dt><dd>{profile.email}</dd>
              <dt>Date of birth</dt><dd>{profile.date_of_birth ? formatDate(profile.date_of_birth) : "—"}</dd>
              <dt>Emergency contact</dt><dd>{profile.emergency_contact || "—"}</dd>
              <dt>Address</dt><dd>{profile.address || "—"}</dd>
              <dt>Visits with you</dt><dd>{patient.visits.length}</dd>
            </dl>
          )}
          {tab === "visits" && patient.visits.map((v) => (
            <div className="list-item" key={v.id} style={{ padding: ".8rem 0" }}>
              <CalendarDays size={18} className="faint" style={{ marginTop: 2 }} />
              <div className="grow"><div className="row-between"><strong>{formatDate(v.appointment_date)} · {formatTime(v.appointment_time)}</strong><StatusBadge status={v.status} /></div>
                {v.consultation_notes ? <p className="muted small" style={{ marginTop: 4 }}>{v.consultation_notes}</p> : <p className="faint small">No notes recorded.</p>}</div>
            </div>
          ))}
          {tab === "records" && (
            <>
              <form onSubmit={addNote} className="card card-pad mb-2" style={{ background: "var(--surface-2)" }}>
                <div className="field"><label>Add a chart note</label>
                  <select value={note.record_type} onChange={(e) => setNote({ ...note, record_type: e.target.value })}>{NOTE_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
                <div className="field"><textarea className="textarea" placeholder="What should future visits know about this patient?" value={note.notes} onChange={(e) => setNote({ ...note, notes: e.target.value })} /></div>
                <button className="btn btn-primary btn-sm" disabled={busy || !note.notes.trim()}><Plus size={15} /> {busy ? "Saving…" : "Add note"}</button>
              </form>
              {records.length === 0 ? <EmptyState icon={FileText} title="No records yet" /> : records.map((r) => (
                <div className="list-item" key={r.id} style={{ padding: ".8rem 0" }}>
                  <FileText size={18} className="faint" style={{ marginTop: 2 }} />
                  <div className="grow"><div className="row-between"><strong style={{ textTransform: "capitalize" }}>{r.record_type.replace(/_/g, " ")}</strong><span className="faint small">{formatDate(r.created_at.slice(0, 10))}</span></div><p className="muted small">{r.notes}</p></div>
                </div>
              ))}
            </>
          )}
          {tab === "rx" && (rx.length === 0 ? <EmptyState icon={Pill} title="No prescriptions yet" /> : rx.map((p) => (
            <div className="rx-item" key={p.id}><div className="rx-head"><strong className="small">Issued {formatDate(p.created_at.slice(0, 10))}</strong></div>
              <ul style={{ margin: 0, padding: ".6rem 1.6rem" }}>{p.items.map((i) => <li key={i.id}><strong>{i.medicine_name}</strong> — {i.dosage}, {i.frequency}, {i.duration_days} days</li>)}</ul></div>
          )))}
        </>
      )}
    </Modal>
  );
}

export default function DoctorPatients() {
  const [appts, setAppts] = useState(null);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(null);
  useEffect(() => { api.get("/appointments").then((r) => setAppts(r.data)); }, []);

  const patients = useMemo(() => {
    const m = new Map();
    (appts || []).forEach((a) => {
      if (!m.has(a.patient_id)) m.set(a.patient_id, { id: a.patient_id, name: a.patient_name, visits: [] });
      m.get(a.patient_id).visits.push(a);
    });
    return [...m.values()].map((p) => ({ ...p, visits: p.visits.sort((a, b) => (b.appointment_date + b.appointment_time).localeCompare(a.appointment_date + a.appointment_time)) }))
      .filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase()));
  }, [appts, q]);

  return (
    <>
      <PageHeader title="My patients" subtitle="Everyone you've had an appointment with. Open a chart for their full history." />
      <div className="search mb-2" style={{ maxWidth: 360 }}><Search size={16} /><input className="input" placeholder="Search patients" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="card card-flush">
        {!appts ? <SkeletonRows /> : patients.length === 0 ? <EmptyState icon={Users} title="No patients yet" text="Patients appear here after they book with you." /> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Patient</th><th>Visits</th><th>Last visit</th><th></th></tr></thead>
            <tbody>{patients.map((p) => (
              <tr key={p.id}>
                <td><div className="row"><Avatar name={p.name} size="sm" /><strong>{p.name}</strong></div></td>
                <td>{p.visits.length}</td>
                <td className="muted">{formatDate(p.visits[0].appointment_date, { day: "numeric", month: "short", year: "numeric" })}</td>
                <td className="right"><button className="btn btn-secondary btn-sm" onClick={() => setSel(p)}>Open chart</button></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </div>
      {sel && <Chart patient={sel} onClose={() => setSel(null)} />}
    </>
  );
}
