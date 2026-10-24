import { useEffect, useState } from "react";
import { Plus, X, Clock } from "lucide-react";
import api, { errorMessage } from "../../api/client";
import { EmptyState, Modal, PageHeader, SkeletonRows } from "../../components/ui.jsx";
import { useToast } from "../../components/Toast.jsx";
import { formatTime } from "../../utils";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const hm = (t) => t.slice(0, 5);
const mins = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };

export default function DoctorAvailability() {
  const toast = useToast();
  const [doctorId, setDoctorId] = useState(null);
  const [blocks, setBlocks] = useState(null);
  const [adding, setAdding] = useState(false);
  const [days, setDays] = useState([0, 1, 2, 3, 4]);
  const [form, setForm] = useState({ start_time: "09:00", end_time: "13:00", slot_duration_minutes: 30 });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = (id) => api.get(`/doctors/${id}/availability`).then((r) => setBlocks(r.data));
  useEffect(() => { api.get("/doctors/me").then((r) => { setDoctorId(r.data.id); load(r.data.id); }); }, []);

  const totalMinutes = (blocks || []).reduce((s, b) => s + mins(b.end_time) - mins(b.start_time), 0);
  const slotsPerWeek = (blocks || []).reduce((s, b) => s + Math.floor((mins(b.end_time) - mins(b.start_time)) / b.slot_duration_minutes), 0);

  async function save(e) {
    e.preventDefault(); setError("");
    if (!days.length) return setError("Pick at least one day.");
    if (mins(form.end_time) <= mins(form.start_time)) return setError("End time must be after start time.");
    const clash = days.find((d) => (blocks || []).some((b) => b.day_of_week === d && mins(form.start_time) < mins(b.end_time) && mins(form.end_time) > mins(b.start_time)));
    if (clash !== undefined) return setError(`That overlaps an existing block on ${DAYS[clash]}. Delete it first or choose different times.`);
    setBusy(true);
    try {
      for (const d of days) await api.post(`/doctors/${doctorId}/availability`, { day_of_week: d, ...form });
      toast.success(`Added availability for ${days.length} day${days.length > 1 ? "s" : ""}.`);
      setAdding(false); await load(doctorId);
    } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  }
  async function remove(b) {
    try { await api.delete(`/doctors/${doctorId}/availability/${b.id}`); setBlocks((p) => p.filter((x) => x.id !== b.id)); toast.success("Block removed."); }
    catch (e) { toast.error(errorMessage(e)); }
  }

  return (
    <>
      <PageHeader title="Weekly availability" subtitle="Patients can book into these recurring blocks. They repeat every week.">
        <button className="btn btn-primary" onClick={() => { setAdding(true); setError(""); }}><Plus size={16} /> Add availability</button>
      </PageHeader>

      {!blocks ? <div className="card"><SkeletonRows /></div> : blocks.length === 0 ? (
        <div className="card"><EmptyState icon={Clock} title="No availability published" text="Add your working hours so patients can start booking with you." action={<button className="btn btn-primary" onClick={() => setAdding(true)}>Add availability</button>} /></div>
      ) : (
        <>
          <div className="row wrap mb-2 muted small" style={{ gap: "1.5rem" }}>
            <span><strong style={{ color: "var(--ink)" }}>{(totalMinutes / 60).toFixed(1)}</strong> hours / week</span>
            <span><strong style={{ color: "var(--ink)" }}>{slotsPerWeek}</strong> bookable slots / week</span>
          </div>
          <div className="week-grid">
            {DAYS.map((name, d) => {
              const day = blocks.filter((b) => b.day_of_week === d).sort((a, b) => a.start_time.localeCompare(b.start_time));
              return (
                <div className="week-col" key={name}>
                  <h4>{name.slice(0, 3)}</h4>
                  {day.length === 0 ? <span className="faint small">Off</span> : day.map((b) => (
                    <div className="block" key={b.id}>
                      <div className="row-between"><strong>{formatTime(hm(b.start_time))} – {formatTime(hm(b.end_time))}</strong>
                        <button className="x" onClick={() => remove(b)} aria-label={`Remove ${name} block`}><X size={14} /></button></div>
                      <div className="faint">{b.slot_duration_minutes}-min slots</div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </>
      )}

      {adding && (
        <Modal title="Add availability" subtitle="Create the same block on several days at once." onClose={() => setAdding(false)}
          footer={<><button className="btn btn-secondary" onClick={() => setAdding(false)}>Cancel</button><button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? "Saving…" : "Add block"}</button></>}>
          <div className="field"><label>Days</label>
            <div className="row wrap">{DAYS.map((n, d) => <button type="button" key={n} className={`chip ${days.includes(d) ? "active" : ""}`} onClick={() => setDays(days.includes(d) ? days.filter((x) => x !== d) : [...days, d])}>{n.slice(0, 3)}</button>)}</div></div>
          <div className="form-grid">
            <div className="field"><label>Start time</label><input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} /></div>
            <div className="field"><label>End time</label><input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} /></div>
            <div className="field full"><label>Appointment length</label>
              <select value={form.slot_duration_minutes} onChange={(e) => setForm({ ...form, slot_duration_minutes: Number(e.target.value) })}>{[15, 20, 30, 45, 60].map((m) => <option key={m} value={m}>{m} minutes</option>)}</select></div>
          </div>
          {error && <p className="form-error">{error}</p>}
        </Modal>
      )}
    </>
  );
}
