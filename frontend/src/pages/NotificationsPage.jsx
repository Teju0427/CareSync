import { useEffect, useState } from "react";
import api from "../api/client";

const TYPE_LABEL = {
  appointment_booked: "New booking",
  appointment_reminder: "Reminder",
  appointment_status_change: "Status update",
  prescription_added: "Prescription",
  system: "System",
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    api.get("/notifications").then((res) => setNotifications(res.data)).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function markRead(id) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    try {
      await api.put(`/notifications/${id}/read`);
    } catch {
      load(); // fall back to the server's actual state if the update failed
    }
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Notifications</h1>
          <p>{unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up."}</p>
        </div>
      </div>

      {loading ? (
        <p>Loading…</p>
      ) : notifications.length === 0 ? (
        <div className="empty-state">Nothing here yet — booking and status updates will show up in this list.</div>
      ) : (
        <div className="panel" style={{ padding: 0 }}>
          {notifications.map((n) => (
            <div
              key={n.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: "1rem",
                padding: "0.9rem 1.1rem",
                borderBottom: "1px solid var(--color-line)",
                background: n.is_read ? "transparent" : "var(--color-primary-soft)",
              }}
            >
              <div>
                <span
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    color: "var(--color-primary)",
                    textTransform: "uppercase",
                    letterSpacing: "0.03em",
                  }}
                >
                  {TYPE_LABEL[n.type] || n.type}
                </span>
                <p style={{ margin: "0.25em 0 0.15em 0" }}>{n.message}</p>
                <span style={{ fontSize: "0.8rem", color: "var(--color-muted)" }}>
                  {new Date(n.created_at).toLocaleString()}
                </span>
              </div>
              {!n.is_read && (
                <button className="btn btn-secondary" onClick={() => markRead(n.id)} style={{ flexShrink: 0 }}>
                  Mark read
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
