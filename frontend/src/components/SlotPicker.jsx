import { useEffect, useMemo, useState } from "react";
import api from "../api/client";
import { toISODate, formatTime } from "../utils";

const DAYS_AHEAD = 21;

/** Date strip + grouped time slots for one doctor. Days the doctor doesn't work are disabled. */
export default function SlotPicker({ doctorId, value, onChange }) {
  const [workingDays, setWorkingDays] = useState(null);
  const [date, setDate] = useState(value?.date || null);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);

  const days = useMemo(() => {
    const out = [];
    const start = new Date();
    for (let i = 0; i < DAYS_AHEAD; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      out.push({ iso: toISODate(d), dow: (d.getDay() + 6) % 7, label: d.toLocaleDateString("en-IN", { weekday: "short" }), dom: d.getDate(), mon: d.toLocaleDateString("en-IN", { month: "short" }) });
    }
    return out;
  }, []);

  useEffect(() => {
    let alive = true;
    api.get(`/doctors/${doctorId}/availability`).then((r) => {
      if (!alive) return;
      const set = new Set(r.data.map((b) => b.day_of_week));
      setWorkingDays(set);
      if (!date) {
        const first = days.find((d) => set.has(d.dow));
        if (first) setDate(first.iso);
      }
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doctorId]);

  useEffect(() => {
    if (!date) return;
    let alive = true;
    setLoading(true);
    api.get(`/doctors/${doctorId}/available-slots`, { params: { for_date: date } })
      .then((r) => alive && setSlots(r.data))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [doctorId, date]);

  // Hide slots that have already passed today
  const visible = useMemo(() => {
    const now = new Date();
    const isToday = date === toISODate(now);
    return slots.filter((s) => {
      if (!isToday) return true;
      const [h, m] = s.time.split(":").map(Number);
      return h * 60 + m > now.getHours() * 60 + now.getMinutes();
    });
  }, [slots, date]);

  const groups = [
    { label: "Morning", items: visible.filter((s) => +s.time.slice(0, 2) < 12) },
    { label: "Afternoon", items: visible.filter((s) => +s.time.slice(0, 2) >= 12 && +s.time.slice(0, 2) < 17) },
    { label: "Evening", items: visible.filter((s) => +s.time.slice(0, 2) >= 17) },
  ].filter((g) => g.items.length);

  if (workingDays && workingDays.size === 0) {
    return <p className="muted">This doctor hasn't published any availability yet.</p>;
  }

  return (
    <div>
      <div className="datestrip">
        {days.map((d) => (
          <button
            key={d.iso}
            type="button"
            className={`datechip ${date === d.iso ? "active" : ""}`}
            disabled={workingDays ? !workingDays.has(d.dow) : true}
            onClick={() => { setDate(d.iso); onChange(null); }}
          >
            <div className="dow">{d.label}</div>
            <div className="dom">{d.dom}</div>
            <div className="dow">{d.mon}</div>
          </button>
        ))}
      </div>
      {loading ? (
        <div className="skeleton" style={{ height: 80, marginTop: 12 }} />
      ) : groups.length === 0 ? (
        <p className="muted mt-2">No open slots on this day. Try another date.</p>
      ) : (
        groups.map((g) => (
          <div key={g.label}>
            <div className="slot-group-label">{g.label}</div>
            <div className="slot-grid">
              {g.items.map((s) => (
                <button
                  key={s.time}
                  type="button"
                  className={`slot ${value?.time === s.time && value?.date === date ? "active" : ""}`}
                  onClick={() => onChange({ date, time: s.time })}
                >
                  {formatTime(s.time)}
                </button>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
