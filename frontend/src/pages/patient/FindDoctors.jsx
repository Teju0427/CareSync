import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Briefcase, IndianRupee, Stethoscope, CalendarCheck, Sparkles } from "lucide-react";
import api, { errorMessage } from "../../api/client";
import { Avatar, Modal, PageHeader, EmptyState, SkeletonRows } from "../../components/ui.jsx";
import SlotPicker from "../../components/SlotPicker.jsx";
import { useToast } from "../../components/Toast.jsx";
import { formatDate, formatTime } from "../../utils";

const REASONS = ["Routine check-up", "Follow-up visit", "New symptoms", "Specialist consultation"];

function BookingModal({ doctor, onClose }) {
  const toast = useToast();
  const navigate = useNavigate();
  const [slot, setSlot] = useState(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function book() {
    setBusy(true); setError("");
    try {
      await api.post("/appointments", { doctor_id: doctor.id, appointment_date: slot.date, appointment_time: slot.time, reason: reason || null });
      toast.success(`Booked with ${doctor.full_name} on ${formatDate(slot.date, { day: "numeric", month: "short" })} at ${formatTime(slot.time)}.`);
      onClose();
      navigate("/patient/appointments");
    } catch (err) {
      setError(errorMessage(err));
      setSlot(null);
    } finally { setBusy(false); }
  }

  return (
    <Modal
      large
      title={`Book with ${doctor.full_name}`}
      subtitle={`${doctor.specialization}${doctor.department_name ? " · " + doctor.department_name : ""} · ₹${doctor.consultation_fee} consultation`}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={!slot || busy} onClick={book}>
            <CalendarCheck size={16} />
            {busy ? "Booking…" : slot ? `Confirm ${formatTime(slot.time)}, ${formatDate(slot.date, { day: "numeric", month: "short" })}` : "Select a time"}
          </button>
        </>
      }
    >
      <h3 className="mb-2">1. Choose a date &amp; time</h3>
      <SlotPicker doctorId={doctor.id} value={slot} onChange={setSlot} />
      <h3 className="mt-3 mb-2">2. What's the visit about? <span className="faint small" style={{ fontWeight: 500 }}>(optional)</span></h3>
      <div className="row wrap mb-2">
        {REASONS.map((r) => <button key={r} type="button" className={`chip ${reason === r ? "active" : ""}`} onClick={() => setReason(reason === r ? "" : r)}>{r}</button>)}
      </div>
      <div className="field">
        <textarea className="textarea" placeholder="Anything the doctor should know in advance…" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
        <span className="hint"><Sparkles size={12} style={{ verticalAlign: -1 }} /> Used only to categorise the visit type for scheduling.</span>
      </div>
      {error && <p className="form-error">{error}</p>}
    </Modal>
  );
}

export default function FindDoctors() {
  const [doctors, setDoctors] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [dept, setDept] = useState("");
  const [query, setQuery] = useState("");
  const [booking, setBooking] = useState(null);

  useEffect(() => {
    api.get("/doctors").then((r) => setDoctors(r.data));
    api.get("/admin/departments").then((r) => setDepartments(r.data));
  }, []);

  const filtered = useMemo(() => (doctors || []).filter((d) =>
    (!dept || String(d.department_id) === dept) &&
    (!query || `${d.full_name} ${d.specialization}`.toLowerCase().includes(query.toLowerCase()))
  ), [doctors, dept, query]);

  return (
    <>
      <PageHeader title="Find a doctor" subtitle="Browse our doctors, then pick a time that suits you." />
      <div className="row wrap mb-2" style={{ gap: ".75rem" }}>
        <div className="search grow" style={{ minWidth: 220 }}>
          <Search size={16} />
          <input className="input" placeholder="Search by name or specialization" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search doctors" />
        </div>
      </div>
      <div className="row wrap mb-3" style={{ gap: ".5rem" }}>
        <button className={`chip ${dept === "" ? "active" : ""}`} onClick={() => setDept("")}>All departments</button>
        {departments.map((d) => <button key={d.id} className={`chip ${dept === String(d.id) ? "active" : ""}`} onClick={() => setDept(String(d.id))}>{d.name}</button>)}
      </div>

      {!doctors ? <div className="card"><SkeletonRows rows={3} height={80} /></div> : filtered.length === 0 ? (
        <div className="card"><EmptyState icon={Stethoscope} title="No doctors match" text="Try a different department or clear the search." /></div>
      ) : (
        <div className="doctor-grid">
          {filtered.map((d) => (
            <div className="card doctor-card" key={d.id}>
              <div className="row" style={{ gap: ".9rem" }}>
                <Avatar name={d.full_name} size="lg" />
                <div className="grow">
                  <h3>{d.full_name}</h3>
                  <div className="muted small">{d.specialization}</div>
                  {d.department_name && <span className="badge badge-neutral" style={{ marginTop: 6 }}>{d.department_name}</span>}
                </div>
              </div>
              {d.bio && <p className="muted small" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{d.bio}</p>}
              <div className="meta-row">
                <span><Briefcase size={14} /> {d.years_experience} yrs experience</span>
                <span><IndianRupee size={14} /> {d.consultation_fee} fee</span>
              </div>
              <button className="btn btn-primary btn-block" onClick={() => setBooking(d)}><CalendarCheck size={16} /> Book appointment</button>
            </div>
          ))}
        </div>
      )}
      {booking && <BookingModal doctor={booking} onClose={() => setBooking(null)} />}
    </>
  );
}
