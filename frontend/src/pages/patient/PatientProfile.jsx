import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import api, { errorMessage } from "../../api/client";
import { Avatar, PageHeader } from "../../components/ui.jsx";
import PasswordCard from "../../components/PasswordCard.jsx";
import { useToast } from "../../components/Toast.jsx";
import { calcAge } from "../../utils";

const FIELDS = ["date_of_birth", "gender", "blood_group", "address", "emergency_contact"];
const BLOOD = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

export default function PatientProfile() {
  const toast = useToast();
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/patients/me").then((r) => { setProfile(r.data); setForm(r.data); }).catch((e) => setError(errorMessage(e)));
  }, []);

  if (error) return <p className="form-error">{error}</p>;
  if (!profile) return <div className="skeleton" style={{ height: 320 }} />;

  const filled = FIELDS.filter((f) => form[f]).length;
  const pct = Math.round((filled / FIELDS.length) * 100);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.put(`/patients/${profile.id}`, Object.fromEntries(FIELDS.map((f) => [f, form[f] || null])));
      setProfile(res.data); setForm(res.data);
      toast.success("Profile saved.");
    } catch (err) { toast.error(errorMessage(err)); } finally { setBusy(false); }
  }

  const age = calcAge(profile.date_of_birth);
  return (
    <>
      <PageHeader title="My profile" subtitle="Keep your details current so doctors have what they need." />
      <div className="grid-2">
        <form className="card" onSubmit={save}>
          <div className="card-head"><h3>Personal information</h3></div>
          <div className="card-body">
            <div className="form-grid">
              <div className="field"><label>Full name</label><input value={profile.full_name} disabled /></div>
              <div className="field"><label>Email</label><input value={profile.email} disabled /></div>
              <div className="field"><label htmlFor="dob">Date of birth</label><input id="dob" type="date" max={new Date().toISOString().slice(0, 10)} value={form.date_of_birth || ""} onChange={set("date_of_birth")} /></div>
              <div className="field"><label htmlFor="gender">Gender</label>
                <select id="gender" value={form.gender || ""} onChange={set("gender")}><option value="">Prefer not to say</option><option>Female</option><option>Male</option><option>Non-binary</option><option>Other</option></select>
              </div>
              <div className="field"><label htmlFor="bg">Blood group</label>
                <select id="bg" value={form.blood_group || ""} onChange={set("blood_group")}><option value="">Unknown</option>{BLOOD.map((b) => <option key={b}>{b}</option>)}</select>
              </div>
              <div className="field"><label htmlFor="ec">Emergency contact</label><input id="ec" value={form.emergency_contact || ""} onChange={set("emergency_contact")} placeholder="Phone number" /></div>
              <div className="field full"><label htmlFor="addr">Address</label><textarea id="addr" value={form.address || ""} onChange={set("address")} /></div>
            </div>
            <button className="btn btn-primary" disabled={busy}><Save size={16} /> {busy ? "Saving…" : "Save changes"}</button>
          </div>
        </form>
        <div className="stack">
          <div className="card card-pad">
            <div className="row" style={{ gap: "1rem" }}>
              <Avatar name={profile.full_name} size="lg" />
              <div><h3>{profile.full_name}</h3><p className="muted small">{age != null ? `${age} years` : "Age not set"}{profile.blood_group ? ` · ${profile.blood_group}` : ""}</p></div>
            </div>
            <div className="mt-2">
              <div className="row-between small"><span className="muted">Profile completeness</span><strong>{pct}%</strong></div>
              <div className="progress mt-1"><span style={{ width: `${pct}%` }} /></div>
            </div>
          </div>
          <PasswordCard />
        </div>
      </div>
    </>
  );
}
