import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Stethoscope } from "lucide-react";
import api, { errorMessage } from "../../api/client";
import { Avatar, ConfirmDialog, EmptyState, Modal, PageHeader, SkeletonRows } from "../../components/ui.jsx";
import { useToast } from "../../components/Toast.jsx";

const EMPTY = { full_name: "", email: "", password: "", phone: "", department_id: "", specialization: "", license_number: "", years_experience: 0, consultation_fee: 0, bio: "" };

export default function AdminDoctors() {
  const toast = useToast();
  const [doctors, setDoctors] = useState(null);
  const [depts, setDepts] = useState([]);
  const [modal, setModal] = useState(null);      // { mode: 'add' | 'edit', doctor? }
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [remove, setRemove] = useState(null);

  const load = () => { api.get("/doctors").then((r) => setDoctors(r.data)); api.get("/admin/departments").then((r) => setDepts(r.data)); };
  useEffect(load, []);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === "number" ? Number(e.target.value) : e.target.value });

  function openAdd() { setForm(EMPTY); setError(""); setModal({ mode: "add" }); }
  function openEdit(d) { setForm({ ...EMPTY, ...d, department_id: d.department_id ?? "" }); setError(""); setModal({ mode: "edit", doctor: d }); }

  async function submit(e) {
    e.preventDefault(); setError(""); setBusy(true);
    try {
      const dept = form.department_id === "" ? null : Number(form.department_id);
      if (modal.mode === "add") {
        await api.post("/admin/doctors", { ...form, department_id: dept, phone: form.phone || null, bio: form.bio || null });
        toast.success(`${form.full_name} added.`);
      } else {
        await api.put(`/doctors/${modal.doctor.id}`, { department_id: dept, specialization: form.specialization, years_experience: form.years_experience, consultation_fee: form.consultation_fee, bio: form.bio || null });
        toast.success("Doctor updated.");
      }
      setModal(null); load();
    } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  }
  async function doRemove() {
    setBusy(true);
    try { await api.delete(`/admin/doctors/${remove.id}`); toast.success("Doctor removed."); setRemove(null); load(); }
    catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  }

  return (
    <>
      <PageHeader title="Doctors" subtitle="Provision doctor accounts and manage the roster."><button className="btn btn-primary" onClick={openAdd}><Plus size={16} /> Add doctor</button></PageHeader>
      <div className="card card-flush">
        {!doctors ? <SkeletonRows /> : doctors.length === 0 ? <EmptyState icon={Stethoscope} title="No doctors yet" text="Add your first doctor to open the clinic for bookings." action={<button className="btn btn-primary" onClick={openAdd}>Add doctor</button>} /> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Doctor</th><th>Specialization</th><th>Department</th><th>Experience</th><th>Fee</th><th></th></tr></thead>
            <tbody>{doctors.map((d) => (
              <tr key={d.id}>
                <td><div className="row"><Avatar name={d.full_name} size="sm" /><div><strong>{d.full_name}</strong><div className="faint small">{d.email}</div></div></div></td>
                <td>{d.specialization}</td><td>{d.department_name ? <span className="badge badge-neutral">{d.department_name}</span> : <span className="faint">—</span>}</td>
                <td>{d.years_experience} yrs</td><td>₹{d.consultation_fee}</td>
                <td className="right nowrap"><button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEdit(d)} aria-label={`Edit ${d.full_name}`}><Pencil size={16} /></button>
                  <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setRemove(d)} aria-label={`Remove ${d.full_name}`}><Trash2 size={16} /></button></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </div>

      {modal && (
        <Modal large title={modal.mode === "add" ? "Add doctor" : `Edit ${modal.doctor.full_name}`} onClose={() => setModal(null)}
          footer={<><button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button><button className="btn btn-primary" form="doctor-form" disabled={busy}>{busy ? "Saving…" : modal.mode === "add" ? "Add doctor" : "Save changes"}</button></>}>
          <form id="doctor-form" onSubmit={submit}>
            <div className="form-grid">
              {modal.mode === "add" && <>
                <div className="field"><label>Full name</label><input value={form.full_name} onChange={set("full_name")} placeholder="Dr. Jane Doe" required /></div>
                <div className="field"><label>Email</label><input type="email" value={form.email} onChange={set("email")} required /></div>
                <div className="field"><label>Temporary password</label><input type="password" minLength={8} value={form.password} onChange={set("password")} required /></div>
                <div className="field"><label>Phone</label><input value={form.phone} onChange={set("phone")} /></div>
                <div className="field"><label>Licence number</label><input value={form.license_number} onChange={set("license_number")} required /></div>
              </>}
              <div className="field"><label>Specialization</label><input value={form.specialization} onChange={set("specialization")} required /></div>
              <div className="field"><label>Department</label><select value={form.department_id} onChange={set("department_id")}><option value="">None</option>{depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
              <div className="field"><label>Years of experience</label><input type="number" min={0} value={form.years_experience} onChange={set("years_experience")} /></div>
              <div className="field"><label>Consultation fee (₹)</label><input type="number" min={0} value={form.consultation_fee} onChange={set("consultation_fee")} /></div>
              <div className="field full"><label>Bio</label><textarea value={form.bio} onChange={set("bio")} /></div>
            </div>
            {error && <p className="form-error">{error}</p>}
          </form>
        </Modal>
      )}
      {remove && <ConfirmDialog danger busy={busy} title={`Remove ${remove.full_name}?`} confirmLabel="Remove doctor" onClose={() => setRemove(null)} onConfirm={doRemove}
        message="This deletes the doctor's account along with their availability and all of their appointments. This can't be undone." />}
    </>
  );
}
