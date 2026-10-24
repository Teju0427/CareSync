import { useEffect, useState } from "react";
import { Bell, CheckCheck, CalendarPlus, CalendarClock, Pill, Info } from "lucide-react";
import api from "../api/client";
import { PageHeader, EmptyState, SkeletonRows } from "../components/ui.jsx";

const META = {
  appointment_booked: { icon: CalendarPlus, tone: "tone-teal", label: "New booking" },
  appointment_reminder: { icon: CalendarClock, tone: "tone-amber", label: "Reminder" },
  appointment_status_change: { icon: CalendarClock, tone: "tone-blue", label: "Status update" },
  prescription_added: { icon: Pill, tone: "tone-green", label: "Prescription" },
  system: { icon: Info, tone: "tone-slate", label: "System" },
};

function timeAgo(iso) {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso + (iso.endsWith("Z") ? "" : "Z")).getTime()) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

export default function NotificationsPage() {
  const [items, setItems] = useState(null);
  const load = () => api.get("/notifications").then((r) => setItems(r.data));
  useEffect(() => { load(); }, []);

  const unread = (items || []).filter((n) => !n.is_read);

  async function markRead(id) {
    setItems((p) => p.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    api.put(`/notifications/${id}/read`).catch(load);
  }
  async function markAll() {
    setItems((p) => p.map((n) => ({ ...n, is_read: true })));
    await Promise.all(unread.map((n) => api.put(`/notifications/${n.id}/read`))).catch(load);
  }

  return (
    <>
      <PageHeader title="Notifications" subtitle={unread.length ? `${unread.length} unread` : "You're all caught up."}>
        {unread.length > 0 && <button className="btn btn-secondary" onClick={markAll}><CheckCheck size={16} /> Mark all as read</button>}
      </PageHeader>
      <div className="card card-flush">
        {!items ? <SkeletonRows /> : items.length === 0 ? (
          <EmptyState icon={Bell} title="No notifications yet" text="Bookings, status changes and new prescriptions will appear here." />
        ) : items.map((n) => {
          const m = META[n.type] || META.system;
          return (
            <div key={n.id} className={`list-item ${n.is_read ? "" : "unread"}`}>
              <div className={`stat-icon ${m.tone}`} style={{ width: 38, height: 38 }}><m.icon size={18} /></div>
              <div className="grow">
                <div className="row-between"><strong className="small">{m.label}</strong><span className="faint small">{timeAgo(n.created_at)}</span></div>
                <p style={{ marginTop: 2 }}>{n.message}</p>
              </div>
              {!n.is_read && <button className="btn btn-ghost btn-sm" onClick={() => markRead(n.id)}>Mark read</button>}
            </div>
          );
        })}
      </div>
    </>
  );
}
