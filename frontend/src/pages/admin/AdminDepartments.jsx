import { useEffect, useState } from "react";
import { Building2, Plus, Trash2 } from "lucide-react";
import api, { errorMessage } from "../../api/client";
import { ConfirmDialog, EmptyState, PageHeader, SkeletonRows } from "../../components/ui.jsx";
import { useToast } from "../../components/Toast.jsx";

export default function AdminDepartments() {
  const toast = useToast();
  const [depts, setDepts] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [form, setForm] = useState({ name: "", description: "" });
  const [error, setError] = useState("");
  const [remove, setRemove] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = () => { api.get("/admin/departments").then((r) => setDepts(r.data)); api.get("/doctors").then((r) => setDoctors(r.data)); };
  useEffect(load, []);

  async function add(e) {
    e.preventDefault(); setError("");
    try { await api.post("/admin/departments", { name: form.name.trim(), description: form.description.trim() || null }); toast.success("Department added."); setForm({ name: "", description: "" }); load(); }
    catch (err) { setError(errorMessage(err)); }
  }
  async function doRemove() {
    setBusy(true);
    try { await api.delete(`/admin/departments/${remove.id}`); toast.success("Department removed."); setRemove(null); load(); }
    catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  }

  return (
    <>
      <PageHeader title="Departments" subtitle="Group doctors by specialty area." />
      <div className="grid-2">
        <div className="card card-flush">
          {!depts ? <SkeletonRows /> : depts.length === 0 ? <EmptyState icon={Building2} title="No departments yet" text="Create one using the form." /> : (
            <div className="table-wrap"><table className="table">
              <thead><tr><th>Department</th><th>Doctors</th><th></th></tr></thead>
              <tbody>{depts.map((d) => (
                <tr key={d.id}><td><strong>{d.name}</strong><div className="faint small">{d.description || "No description"}</div></td>
                  <td>{doctors.filter((x) => x.department_id === d.id).length}</td>
                  <td className="right"><button className="btn btn-ghost btn-icon btn-sm" onClick={() => setRemove(d)} aria-label={`Remove ${d.name}`}><Trash2 size={16} /></button></td></tr>
              ))}</tbody>
            </table></div>
          )}
        </div>
        <form className="card" onSubmit={add}>
          <div className="card-head"><h3>Add department</h3></div>
          <div className="card-body">
            <div className="field"><label>Name</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
            <div className="field"><label>Description</label><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            {error && <p className="form-error">{error}</p>}
            <button className="btn btn-primary"><Plus size={16} /> Add department</button>
          </div>
        </form>
      </div>
      {remove && <ConfirmDialog danger busy={busy} title={`Remove ${remove.name}?`} confirmLabel="Remove" onClose={() => setRemove(null)} onConfirm={doRemove} message="Doctors in this department are kept, but become unassigned." />}
    </>
  );
}
