import { useEffect, useState } from "react";
import api from "../../api/client";

export default function PatientProfile() {
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({});
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/patients/me")
      .then((res) => {
        setProfile(res.data);
        setForm(res.data);
      })
      .catch(() => setError("Could not load your profile. Please refresh the page."));
  }, []);

  async function save(e) {
    e.preventDefault();
    const res = await api.put(`/patients/${profile.id}`, {
      date_of_birth: form.date_of_birth || null,
      gender: form.gender || null,
      blood_group: form.blood_group || null,
      address: form.address || null,
      emergency_contact: form.emergency_contact || null,
    });
    setProfile(res.data);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (error) return <p className="error-text">{error}</p>;
  if (!profile) return <p>Loading…</p>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Your profile</h1>
          <p>{profile.full_name} · {profile.email}</p>
        </div>
      </div>

      <form className="panel" style={{ maxWidth: 480 }} onSubmit={save}>
        <div className="field">
          <label>Date of birth</label>
          <input type="date" value={form.date_of_birth || ""} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} />
        </div>
        <div className="field">
          <label>Gender</label>
          <input value={form.gender || ""} onChange={(e) => setForm({ ...form, gender: e.target.value })} />
        </div>
        <div className="field">
          <label>Blood group</label>
          <input value={form.blood_group || ""} onChange={(e) => setForm({ ...form, blood_group: e.target.value })} />
        </div>
        <div className="field">
          <label>Address</label>
          <textarea value={form.address || ""} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </div>
        <div className="field">
          <label>Emergency contact</label>
          <input value={form.emergency_contact || ""} onChange={(e) => setForm({ ...form, emergency_contact: e.target.value })} />
        </div>
        <button className="btn btn-primary" type="submit">Save changes</button>
        {saved && <span style={{ marginLeft: "0.75rem", color: "var(--color-primary)" }}>Saved</span>}
      </form>
    </div>
  );
}
