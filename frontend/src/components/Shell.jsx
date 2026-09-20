import { NavLink, Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../AuthContext.jsx";
import api from "../api/client";

const NAV_BY_ROLE = {
  patient: [
    { to: "/patient", label: "Overview", end: true },
    { to: "/patient/find-doctors", label: "Find a doctor" },
    { to: "/patient/appointments", label: "Appointments" },
    { to: "/patient/records", label: "Records & prescriptions" },
    { to: "/patient/notifications", label: "Notifications" },
    { to: "/patient/profile", label: "Profile" },
  ],
  doctor: [
    { to: "/doctor", label: "Today", end: true },
    { to: "/doctor/patients", label: "My patients" },
    { to: "/doctor/availability", label: "Availability" },
    { to: "/doctor/notifications", label: "Notifications" },
  ],
  admin: [
    { to: "/admin", label: "Dashboard", end: true },
    { to: "/admin/doctors", label: "Doctors" },
    { to: "/admin/departments", label: "Departments" },
  ],
};

export default function Shell() {
  const { user, logout } = useAuth();
  const items = NAV_BY_ROLE[user?.role] || [];
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (user?.role !== "patient" && user?.role !== "doctor") return;
    api.get("/notifications").then((res) => {
      setUnreadCount(res.data.filter((n) => !n.is_read).length);
    });
  }, [user]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">Care<span>Sync</span></div>
        <nav>
          {items.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end}>
              {item.label}
              {item.label === "Notifications" && unreadCount > 0 && (
                <span className="nav-badge">{unreadCount}</span>
              )}
            </NavLink>
          ))}
          <button className="navlink" onClick={logout} style={{ marginTop: "1rem" }}>
            Sign out
          </button>
        </nav>
        <div className="footer-note">
          Signed in as {user?.full_name}
          <br />
          {user?.role}
        </div>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
