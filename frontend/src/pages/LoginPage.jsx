import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, CalendarCheck, ShieldCheck, Brain, AlertCircle, Eye, EyeOff } from "lucide-react";
import { useAuth } from "../AuthContext.jsx";
import { errorMessage } from "../api/client";

const DEMO = [
  { role: "Doctor", email: "dr.sharma@gmail.com" },
  { role: "Admin", email: "admin@caresync.app" },
];

export default function LoginPage() {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ email: "", password: "", full_name: "", phone: "" });
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const user = mode === "login"
        ? await login(form.email.trim(), form.password)
        : await register({ email: form.email.trim(), password: form.password, full_name: form.full_name.trim(), phone: form.phone || null, role: "patient" });
      navigate(`/${user.role}`);
    } catch (err) {
      setError(errorMessage(err, mode === "login" ? "Couldn't sign you in." : "Couldn't create your account."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <section className="auth-hero">
        <div className="brand" style={{ padding: 0 }}>
          <div className="brand-mark"><Activity size={19} strokeWidth={2.6} /></div> CareSync
        </div>
        <div>
          <h1>Care that runs on time.</h1>
          <p>One place for appointments, patient records and clinic operations — built for patients, doctors and the people who keep a clinic running.</p>
          <div className="feature-list">
            <div><span className="ficon"><CalendarCheck size={18} /></span><p><strong>Real-time booking</strong><span>See genuinely open slots and book in seconds — no phone tag.</span></p></div>
            <div><span className="ficon"><Brain size={18} /></span><p><strong>Scheduling intelligence</strong><span>No-show risk estimates help clinics plan their day. Never diagnostic.</span></p></div>
            <div><span className="ficon"><ShieldCheck size={18} /></span><p><strong>Role-based access</strong><span>Patients, doctors and admins each see only what they should.</span></p></div>
          </div>
        </div>
        <p className="small" style={{ color: "#6f8796" }}>Portfolio project · synthetic data only · not for clinical use.</p>
      </section>

      <section className="auth-panel">
        <form className="auth-form" onSubmit={submit}>
          <h2 style={{ fontSize: "1.55rem" }}>{mode === "login" ? "Welcome back" : "Create your account"}</h2>
          <p className="muted" style={{ marginTop: 4 }}>{mode === "login" ? "Sign in to manage your care." : "Patient accounts are free. Doctors are added by clinic admins."}</p>

          <div className="seg" role="tablist">
            <button type="button" className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setError(""); }}>Sign in</button>
            <button type="button" className={mode === "register" ? "active" : ""} onClick={() => { setMode("register"); setError(""); }}>Register</button>
          </div>

          {mode === "register" && (
            <div className="field"><label htmlFor="name">Full name</label><input id="name" value={form.full_name} onChange={set("full_name")} autoComplete="name" required /></div>
          )}
          <div className="field"><label htmlFor="email">Email</label><input id="email" type="email" value={form.email} onChange={set("email")} autoComplete="email" placeholder="you@example.com" required /></div>
          {mode === "register" && (
            <div className="field"><label htmlFor="phone">Phone <span className="faint">(optional)</span></label><input id="phone" value={form.phone} onChange={set("phone")} autoComplete="tel" /></div>
          )}
          <div className="field">
            <label htmlFor="password">Password</label>
            <div style={{ position: "relative" }}>
              <input id="password" type={show ? "text" : "password"} value={form.password} onChange={set("password")} minLength={mode === "register" ? 8 : undefined} autoComplete={mode === "login" ? "current-password" : "new-password"} required style={{ paddingRight: "2.6rem" }} />
              <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"} style={{ position: "absolute", right: 4, top: 4 }}>
                {show ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
            {mode === "register" && <span className="hint">Use at least 8 characters.</span>}
          </div>

          {error && <p className="form-error" role="alert"><AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />{error}</p>}
          <button className="btn btn-primary btn-block" style={{ height: 42 }} disabled={busy}>{busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}</button>

          {mode === "login" && (
            <div className="demo-box">
              <div className="small muted" style={{ marginBottom: 6 }}><strong>Demo accounts</strong> — click to fill the email, then enter the demo password you were given.</div>
              <div className="row wrap">
                {DEMO.map((d) => (
                  <button key={d.email} type="button" className="chip" onClick={() => setForm({ ...form, email: d.email })}>{d.role}</button>
                ))}
              </div>
            </div>
          )}
        </form>
      </section>
    </div>
  );
}
