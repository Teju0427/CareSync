import { useEffect, useState } from "react";
import api from "../../api/client";

export default function AdminDoctors() {
  const [doctors, setDoctors] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [form, setForm] = useState({
    email: "", password: "", full_name: "", phone: "", department_id: "",
    specialization: "", license_number: "", years_experience: 0, consultation_fee: 0, bio: "",
  });
  const [error, setError] = useState("");

  function load() {
    api.get("/doctors").then((res) => setDoctors(res.data));
    api.get("/admin/departments").then((res) => setDepartments(res.data));
  }
  useEffect(load, []);

  async function addDoctor(e) {
    e.preventDefault();
    setError("");
    try {
      await api.post("/admin/doctors", { ...form, department_id: form.department_id || null });
      setForm({ email: "", password: "", full_name: "", phone: "", department_id: "", specialization: "", license_number: "", years_experience: 0, consultation_fee: 0, bio: "" });
      load();
    } catch (err) {
      setError(err.response?.data?.detail || "Could not add doctor.");
    }
  }

  async function removeDoctor(id) {
    await api.delete(`/admin/doctors/${id}`);
    load();
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Doctors</h1>
          <p>Provision doctor accounts and manage the roster.</p>
        </div>
      </div>

      <div className="two-col">
        <div className="panel">
          {doctors.length === 0 ? (
            <div className="empty-state">No doctors yet — add one on the right.</div>
          ) : (
            <table>
              <thead><tr><th>Name</th><th>Specialization</th><th>Department</th><th></th></tr></thead>
              <tbody>
                {doctors.map((d) => (
                  <tr key={d.id}>
                    <td>{d.full_name}</td>
                    <td>{d.specialization}</td>
                    <td>{d.department_name || "—"}</td>
                    <td><button className="btn btn-danger" onClick={() => removeDoctor(d.id)}>Remove</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <form className="panel" onSubmit={addDoctor}>
          <h3>Add doctor</h3>
          <div className="field"><label>Full name</label><input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required /></div>
          <div className="field"><label>Email</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
          <div className="field"><label>Temporary password</label><input type="password" minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></div>
          <div className="field"><label>Department</label>
            <select value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })}>
              <option value="">None</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div className="field"><label>Specialization</label><input value={form.specialization} onChange={(e) => setForm({ ...form, specialization: e.target.value })} required /></div>
          <div className="field"><label>License number</label><input value={form.license_number} onChange={(e) => setForm({ ...form, license_number: e.target.value })} required /></div>
          <div className="field"><label>Years of experience</label><input type="number" value={form.years_experience} onChange={(e) => setForm({ ...form, years_experience: Number(e.target.value) })} /></div>
          <div className="field"><label>Consultation fee</label><input type="number" value={form.consultation_fee} onChange={(e) => setForm({ ...form, consultation_fee: Number(e.target.value) })} /></div>
          {error && <p className="error-text">{error}</p>}
          <button className="btn btn-primary" type="submit">Add doctor</button>
        </form>
      </div>
    </div>
  );
}
