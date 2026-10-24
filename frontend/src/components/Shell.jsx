import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  Activity, LayoutDashboard, Stethoscope, CalendarDays, FileText, Bell, UserRound, LogOut, Users,
  Building2, Clock, Menu, ClipboardList, ShieldCheck,
} from "lucide-react";
import { useAuth } from "../AuthContext.jsx";
import api from "../api/client";
import { Avatar } from "./ui.jsx";

const NAV = {
  patient: [
    { section: "Care" },
    { to: "/patient", label: "Overview", icon: LayoutDashboard, end: true },
    { to: "/patient/find-doctors", label: "Find a doctor", icon: Stethoscope },
    { to: "/patient/appointments", label: "Appointments", icon: CalendarDays },
    { to: "/patient/records", label: "Records & prescriptions", icon: FileText },
    { section: "Account" },
    { to: "/patient/notifications", label: "Notifications", icon: Bell, badge: true },
    { to: "/patient/profile", label: "My profile", icon: UserRound },
  ],
  doctor: [
    { section: "Practice" },
    { to: "/doctor", label: "Today", icon: LayoutDashboard, end: true },
    { to: "/doctor/appointments", label: "All appointments", icon: CalendarDays },
    { to: "/doctor/patients", label: "My patients", icon: Users },
    { to: "/doctor/availability", label: "Availability", icon: Clock },
    { section: "Account" },
    { to: "/doctor/notifications", label: "Notifications", icon: Bell, badge: true },
    { to: "/doctor/account", label: "Account", icon: UserRound },
  ],
  admin: [
    { section: "Clinic" },
    { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
    { to: "/admin/appointments", label: "Appointments", icon: ClipboardList },
    { to: "/admin/doctors", label: "Doctors", icon: Stethoscope },
    { to: "/admin/patients", label: "Patients", icon: Users },
    { to: "/admin/departments", label: "Departments", icon: Building2 },
    { section: "Account" },
    { to: "/admin/account", label: "Account", icon: ShieldCheck },
  ],
};

const TITLES = {
  "": "Overview", "find-doctors": "Find a doctor", appointments: "Appointments", records: "Records & prescriptions",
  notifications: "Notifications", profile: "My profile", patients: "Patients", availability: "Availability",
  doctors: "Doctors", departments: "Departments", account: "Account",
};

export default function Shell() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const items = NAV[user?.role] || [];
  const canNotify = user?.role === "patient" || user?.role === "doctor";

  useEffect(() => { setOpen(false); }, [location.pathname]);
  useEffect(() => {
    if (!canNotify) return;
    api.get("/notifications").then((r) => setUnread(r.data.filter((n) => !n.is_read).length)).catch(() => {});
  }, [canNotify, location.pathname]);

  const last = location.pathname.split("/").filter(Boolean)[1] || "";
  const title = TITLES[last] || "CareSync";

  return (
    <div className="app">
      <div className={`scrim ${open ? "open" : ""}`} onClick={() => setOpen(false)} />
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="brand">
          <div className="brand-mark"><Activity size={19} strokeWidth={2.6} /></div>
          CareSync
        </div>
        <nav className="nav" aria-label="Main">
          {items.map((it, i) =>
            it.section ? (
              <div className="nav-label" key={i}>{it.section}</div>
            ) : (
              <NavLink key={it.to} to={it.to} end={it.end}>
                <it.icon size={18} />
                <span>{it.label}</span>
                {it.badge && unread > 0 && <span className="nav-badge">{unread}</span>}
              </NavLink>
            )
          )}
        </nav>
        <div className="sidebar-foot">
          <div className="user-chip">
            <Avatar name={user?.full_name} size="sm" />
            <div className="grow">
              <div className="name">{user?.full_name}</div>
              <div className="role">{user?.role}</div>
            </div>
            <button className="btn btn-ghost btn-icon btn-sm" style={{ color: "#9fb4c0" }} onClick={logout} aria-label="Sign out" title="Sign out">
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="row">
            <button className="btn btn-ghost btn-icon menu-btn" onClick={() => setOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
            <span className="topbar-title">{title}</span>
          </div>
          <div className="row">
            {canNotify && (
              <NavLink to={`/${user.role}/notifications`} className="btn btn-ghost btn-icon" aria-label="Notifications" style={{ position: "relative" }}>
                <Bell size={19} />
                {unread > 0 && <span className="nav-badge" style={{ position: "absolute", top: 0, right: 0, margin: 0 }}>{unread}</span>}
              </NavLink>
            )}
          </div>
        </header>
        <main className="content"><Outlet /></main>
      </div>
    </div>
  );
}
