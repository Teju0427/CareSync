import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarX2, CalendarClock, XCircle, StickyNote } from "lucide-react";
import api, { errorMessage } from "../../api/client";
import { Avatar, ConfirmDialog, EmptyState, Modal, PageHeader, SkeletonRows, StatusBadge, Tabs } from "../../components/ui.jsx";
import SlotPicker from "../../components/SlotPicker.jsx";
import { useToast } from "../../components/Toast.jsx";
import { CATEGORY_LABEL, formatDate, formatTime, relativeDay, todayISO } from "../../utils";

export default function PatientAppointments() {
  const toast = useToast();
  const [appts, setAppts] = useState(null);
  const [tab, setTab] = useState("upcoming");
  const [cancelTarget, setCancelTarget] = useState(null);
  const [moveTarget, setMoveTarget] = useState(null);
  const [slot, setSlot] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () => api.get("/appointments").then((r) => setAppts(r.data));
  useEffect(() => { load(); }, []);

  const today = todayISO();
  const groups = useMemo(() => {
    const list = appts || [];
    const key = (a) => a.appointment_date + a.appointment_time;
    return {
      upcoming: list.filter((a) => a.appointment_date >= today && ["scheduled", "confirmed"].includes(a.status)).sort((a, b) => key(a).localeCompare(key(b))),
      past: list.filter((a) => a.status === "completed" || a.status === "no_show" || (a.appointment_date < today && !["cancelled"].includes(a.status))).sort((a, b) => key(b).localeCompare(key(a))),
      cancelled: list.filter((a) => a.status === "cancelled").sort((a, b) => key(b).localeCompare(key(a))),
    };
  }, [appts, today]);

  async function doCancel() {
    setBusy(true);
    try { await api.put(`/appointments/${cancelTarget.id}/cancel`); toast.success("Appointment cancelled."); setCancelTarget(null); await load(); }
    catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  }
  async function doMove() {
    setBusy(true);
    try {
      await api.put(`/appointments/${moveTarget.id}/reschedule`, { appointment_date: slot.date, appointment_time: slot.time });
      toast.success(`Moved to ${formatDate(slot.date, { day: "numeric", month: "short" })} at ${formatTime(slot.time)}.`);
      setMoveTarget(null); setSlot(null); await load();
    } catch (e) { toast.error(errorMessage(e)); setSlot(null); } finally { setBusy(false); }
  }

  const rows = groups[tab] || [];
  return (
    <>
      <PageHeader title="Appointments" subtitle="Manage upcoming visits and review your history.">
        <Link to="/patient/find-doctors" className="btn btn-primary">Book new</Link>
      </PageHeader>
      <Tabs value={tab} onChange={setTab} tabs={[
        { id: "upcoming", label: "Upcoming", count: groups.upcoming.length },
        { id: "past", label: "Past", count: groups.past.length },
        { id: "cancelled", label: "Cancelled", count: groups.cancelled.length },
      ]} />
      <div className="card card-flush">
        {!appts ? <SkeletonRows /> : rows.length === 0 ? (
          <EmptyState icon={CalendarX2} title={`No ${tab} appointments`} text={tab === "upcoming" ? "Book a visit and it will show up here." : "Nothing to show in this view yet."} />
        ) : rows.map((a) => (
          <div className="appt-card" key={a.id} style={{ alignItems: "flex-start" }}>
            <div className="date-block"><div className="mon">{formatDate(a.appointment_date, { month: "short" })}</div><div className="day">{a.appointment_date.slice(8)}</div></div>
            <Avatar name={a.doctor_name} size="sm" />
            <div className="grow">
              <div className="row wrap" style={{ gap: ".5rem" }}><strong>{a.doctor_name}</strong><StatusBadge status={a.status} /></div>
              <div className="muted small">{relativeDay(a.appointment_date)} · {formatTime(a.appointment_time)} · {CATEGORY_LABEL[a.category] || "Consultation"}</div>
              {a.reason && <div className="small" style={{ marginTop: 4 }}>“{a.reason}”</div>}
              {a.consultation_notes && <div className="small muted row" style={{ marginTop: 6, alignItems: "flex-start" }}><StickyNote size={14} style={{ marginTop: 2, flexShrink: 0 }} /> {a.consultation_notes}</div>}
            </div>
            {tab === "upcoming" && (
              <div className="row">
                <button className="btn btn-secondary btn-sm" onClick={() => { setMoveTarget(a); setSlot(null); }}><CalendarClock size={15} /> Reschedule</button>
                <button className="btn btn-danger btn-sm" onClick={() => setCancelTarget(a)}><XCircle size={15} /> Cancel</button>
              </div>
            )}
          </div>
        ))}
      </div>

      {cancelTarget && (
        <ConfirmDialog danger busy={busy} title="Cancel this appointment?" confirmLabel="Yes, cancel it" onClose={() => setCancelTarget(null)} onConfirm={doCancel}
          message={`Your visit with ${cancelTarget.doctor_name} on ${formatDate(cancelTarget.appointment_date)} at ${formatTime(cancelTarget.appointment_time)} will be cancelled and the slot released.`} />
      )}
      {moveTarget && (
        <Modal large title="Reschedule appointment" subtitle={`With ${moveTarget.doctor_name} · currently ${formatDate(moveTarget.appointment_date)}, ${formatTime(moveTarget.appointment_time)}`} onClose={() => setMoveTarget(null)}
          footer={<><button className="btn btn-secondary" onClick={() => setMoveTarget(null)}>Close</button><button className="btn btn-primary" disabled={!slot || busy} onClick={doMove}>{busy ? "Moving…" : "Confirm new time"}</button></>}>
          <SlotPicker doctorId={moveTarget.doctor_id} value={slot} onChange={setSlot} />
        </Modal>
      )}
    </>
  );
}
