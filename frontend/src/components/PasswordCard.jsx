import { useState } from "react";
import { KeyRound } from "lucide-react";
import api, { errorMessage } from "../api/client";
import { useToast } from "./Toast.jsx";

export default function PasswordCard() {
  const toast = useToast();
  const [form, setForm] = useState({ current_password: "", new_password: "", confirm: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (form.new_password !== form.confirm) return setError("The new passwords don't match.");
    setBusy(true);
    try {
      await api.post("/auth/change-password", { current_password: form.current_password, new_password: form.new_password });
      toast.success("Password updated.");
      setForm({ current_password: "", new_password: "", confirm: "" });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card" onSubmit={submit}>
      <div className="card-head"><h3 className="row"><KeyRound size={18} /> Password &amp; security</h3></div>
      <div className="card-body">
        <div className="field">
          <label htmlFor="cp">Current password</label>
          <input id="cp" type="password" autoComplete="current-password" value={form.current_password} onChange={(e) => setForm({ ...form, current_password: e.target.value })} required />
        </div>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="np">New password</label>
            <input id="np" type="password" autoComplete="new-password" minLength={8} value={form.new_password} onChange={(e) => setForm({ ...form, new_password: e.target.value })} required />
            <span className="hint">At least 8 characters.</span>
          </div>
          <div className="field">
            <label htmlFor="cf">Confirm new password</label>
            <input id="cf" type="password" autoComplete="new-password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} required />
          </div>
        </div>
        {error && <p className="form-error">{error}</p>}
        <button className="btn btn-primary" disabled={busy}>{busy ? "Updating…" : "Update password"}</button>
      </div>
    </form>
  );
}
