import { useEffect, useState } from "react";
import { CheckCircle2, UserX, XCircle, BadgeCheck, Plus, Trash2, Pill, Save } from "lucide-react";
import api, { errorMessage } from "../api/client";
import { Avatar, Modal, RiskBadge, StatusBadge } from "./ui.jsx";
import { useToast } from "./Toast.jsx";
import { CATEGORY_LABEL, formatDate, formatTime } from "../utils";

const FREQ = ["Once daily", "Twice daily", "Three times daily", "Every 8 hours", "At bedtime", "As needed"];
const blank = () => ({ medicine_name: "", dosage: "", frequency: "Twice daily", duration_days: 5, instructions: "" });

export default function ConsultationModal({ appt, onClose, onChanged }) {
  const toast = useToast();
  const [status, setStatus] = useState(appt.status);
  const [notes, setNotes] = useState(appt.consultation_notes || "");
  const [items, setItems] = useState([]);
  const [existing, setExisting] = useState([]);
  const [busy, setBusy] = useState("");

  useEffect(() => {
    api.get(`/prescriptions/patient/${appt.patient_id}`)
      .then((r) => setExisting(r.data.filter((p) => p.appointment_id === appt.id))).catch(() => {});
  }, [appt.id, appt.patient_id]);

  async function setStatusTo(next) {
    setBusy(next);
    try {
      await api.put(`/appointments/${appt.id}/status`, { status: next });
      setStatus(next); toast.success(`Marked as ${next.replace("_", " ")}.`); onChanged();
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(""); }
  }
  async function saveNotes() {
    setBusy("notes");
    try { await api.put(`/appointments/${appt.id}/notes`, { consultation_notes: notes }); toast.success("Consultation notes saved."); onChanged(); }
    catch (e) { toast.error(errorMessage(e)); } finally { setBusy(""); }
  }
  async function saveRx() {
    const clean = items.filter((i) => i.medicine_name.trim());
    if (!clean.length) return toast.error("Add at least one medicine.");
    if (clean.some((i) => !i.dosage.trim())) return toast.error("Each medicine needs a dosage.");
    setBusy("rx");
    try {
      const r = await api.post("/prescriptions", { appointment_id: appt.id, items: clean.map((i) => ({ ...i, instructions: i.instructions || null })) });
      setExisting((e) => [...e, r.data]); setItems([]); toast.success("Prescription saved and patient notified."); onChanged();
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(""); }
  }
  const upd = (i, k, v) => setItems((p) => p.map((row, idx) => (idx === i ? { ...row, [k]: v } : row)));
  const open = ["scheduled", "confirmed"].includes(status);

  return (
    <Modal large title="Consultation" onClose={onClose}
      subtitle={`${formatDate(appt.appointment_date)} · ${formatTime(appt.appointment_time)}`}>
      <div className="row" style={{ gap: "1rem" }}>
        <Avatar name={appt.patient_name} size="lg" />
        <div className="grow">
          <h2>{appt.patient_name}</h2>
          <div className="muted small">{CATEGORY_LABEL[appt.category] || "Consultation"}{appt.reason ? ` · “${appt.reason}”` : ""}</div>
          <div className="row wrap mt-1"><StatusBadge status={status} /><RiskBadge score={appt.no_show_risk_score} /></div>
        </div>
      </div>

      <div className="row wrap mt-2">
        {status === "scheduled" && <button className="btn btn-secondary btn-sm" disabled={!!busy} onClick={() => setStatusTo("confirmed")}><BadgeCheck size={15} /> Confirm</button>}
        {open && <button className="btn btn-primary btn-sm" disabled={!!busy} onClick={() => setStatusTo("completed")}><CheckCircle2 size={15} /> Mark completed</button>}
        {open && <button className="btn btn-secondary btn-sm" disabled={!!busy} onClick={() => setStatusTo("no_show")}><UserX size={15} /> No-show</button>}
        {open && <button className="btn btn-danger btn-sm" disabled={!!busy} onClick={() => setStatusTo("cancelled")}><XCircle size={15} /> Cancel</button>}
      </div>

      <h3 className="mt-3 mb-2">Consultation notes</h3>
      <div className="field"><textarea className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Findings, advice given, follow-up plan…" /></div>
      <button className="btn btn-secondary btn-sm" onClick={saveNotes} disabled={busy === "notes"}><Save size={15} /> {busy === "notes" ? "Saving…" : "Save notes"}</button>

      <h3 className="mt-3 mb-2 row"><Pill size={17} /> Prescription</h3>
      {existing.map((p) => (
        <div key={p.id} className="rx-item"><div className="rx-head"><strong className="small">Issued {formatDate(p.created_at.slice(0, 10))}</strong></div>
          <ul style={{ margin: 0, padding: ".6rem 1.6rem" }}>{p.items.map((i) => <li key={i.id}><strong>{i.medicine_name}</strong> — {i.dosage}, {i.frequency}, {i.duration_days} days</li>)}</ul></div>
      ))}
      {items.map((it, i) => (
        <div key={i} className="card card-pad" style={{ marginBottom: ".6rem", background: "var(--surface-2)" }}>
          <div className="form-grid">
            <div className="field"><label>Medicine</label><input value={it.medicine_name} onChange={(e) => upd(i, "medicine_name", e.target.value)} placeholder="e.g. Paracetamol" /></div>
            <div className="field"><label>Dosage</label><input value={it.dosage} onChange={(e) => upd(i, "dosage", e.target.value)} placeholder="e.g. 500 mg" /></div>
            <div className="field"><label>Frequency</label><select value={it.frequency} onChange={(e) => upd(i, "frequency", e.target.value)}>{FREQ.map((f) => <option key={f}>{f}</option>)}</select></div>
            <div className="field"><label>Duration (days)</label><input type="number" min={1} max={365} value={it.duration_days} onChange={(e) => upd(i, "duration_days", Number(e.target.value) || 1)} /></div>
            <div className="field full" style={{ marginBottom: 0 }}><label>Instructions <span className="faint">(optional)</span></label><input value={it.instructions} onChange={(e) => upd(i, "instructions", e.target.value)} placeholder="e.g. after meals" /></div>
          </div>
          <button className="btn btn-ghost btn-sm mt-1" onClick={() => setItems((p) => p.filter((_, idx) => idx !== i))}><Trash2 size={14} /> Remove</button>
        </div>
      ))}
      <div className="row">
        <button className="btn btn-secondary btn-sm" onClick={() => setItems((p) => [...p, blank()])}><Plus size={15} /> Add medicine</button>
        {items.length > 0 && <button className="btn btn-primary btn-sm" onClick={saveRx} disabled={busy === "rx"}>{busy === "rx" ? "Saving…" : "Save prescription"}</button>}
      </div>
    </Modal>
  );
}
