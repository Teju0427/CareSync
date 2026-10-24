import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// ---- Mocked API: every GET returns realistic fixture data keyed by URL ----
const today = new Date();
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

const appt = (over = {}) => ({
  id: "a1", patient_id: "p1", patient_name: "Asha Verma", doctor_id: "d1", doctor_name: "Dr. Anjali Sharma",
  appointment_date: iso(tomorrow), appointment_time: "10:00:00", status: "scheduled", category: "routine_checkup",
  reason: "Routine check-up", consultation_notes: null, no_show_risk_score: 0.72, created_at: new Date().toISOString(), ...over,
});
const FIXTURES = {
  "/appointments": [appt(), appt({ id: "a2", appointment_date: iso(today), status: "completed", no_show_risk_score: 0.1 }), appt({ id: "a3", status: "cancelled" })],
  "/notifications": [{ id: 1, type: "appointment_booked", message: "New appointment booked", is_read: false, created_at: new Date().toISOString() }],
  "/patients/me": { id: "p1", user_id: "u1", full_name: "Asha Verma", email: "asha@example.com", date_of_birth: "1990-04-02", gender: "Female", blood_group: "O+", address: "Bengaluru", emergency_contact: "9999999999" },
  "/patients/p1": { id: "p1", user_id: "u1", full_name: "Asha Verma", email: "asha@example.com", date_of_birth: "1990-04-02", gender: "Female", blood_group: "O+", address: "Bengaluru", emergency_contact: "9999999999" },
  "/patients": [{ id: "p1", user_id: "u1", full_name: "Asha Verma", email: "asha@example.com", date_of_birth: "1990-04-02", gender: "Female", blood_group: "O+" }],
  "/medical-records/p1": [{ id: "m1", patient_id: "p1", record_type: "consultation_summary", notes: "Mild fatigue.", created_at: new Date().toISOString() }],
  "/prescriptions/patient/p1": [{ id: "r1", appointment_id: "a1", doctor_id: "d1", patient_id: "p1", notes: null, created_at: new Date().toISOString(), items: [{ id: 1, medicine_name: "Paracetamol", dosage: "500 mg", frequency: "Twice daily", duration_days: 5, instructions: "After meals" }] }],
  "/doctors": [{ id: "d1", full_name: "Dr. Anjali Sharma", email: "dr@example.com", department_id: 1, department_name: "General Medicine", specialization: "General Physician", license_number: "L1", years_experience: 12, consultation_fee: 400, bio: "Sees new and follow-up patients." }],
  "/doctors/me": { id: "d1", full_name: "Dr. Anjali Sharma", email: "dr@example.com", specialization: "General Physician" },
  "/doctors/d1/availability": [{ id: 1, doctor_id: "d1", day_of_week: 0, start_time: "09:00:00", end_time: "13:00:00", slot_duration_minutes: 30, is_active: true }],
  "/admin/departments": [{ id: 1, name: "General Medicine", description: "Primary care" }],
  "/admin/dashboard": {
    total_patients: 3, total_doctors: 2, todays_appointments: 1, completed_appointments: 1, cancelled_appointments: 1, no_show_appointments: 0,
    total_appointments: 3, upcoming_appointments: 1, no_show_rate: 0.0,
    status_breakdown: [{ status: "scheduled", count: 1 }, { status: "completed", count: 1 }],
    department_stats: [{ department: "General Medicine", appointment_count: 3 }],
    appointment_trend: Array.from({ length: 14 }, (_, i) => ({ date: iso(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7 + i)), count: i % 3 })),
    doctor_utilization: [{ doctor: "Dr. Anjali Sharma", specialization: "General Physician", appointments: 3 }],
    recent_appointments: [{ id: "a1", patient: "Asha Verma", doctor: "Dr. Anjali Sharma", date: iso(tomorrow), time: "10:00", status: "scheduled", risk: 0.4 }],
  },
};
const SLOTS = [{ date: iso(tomorrow), time: "09:00:00" }, { date: iso(tomorrow), time: "14:30:00" }];

const USERS = {
  patient: { id: "u1", email: "asha@example.com", full_name: "Asha Verma", role: "patient", phone: null, is_active: true },
  doctor: { id: "u2", email: "dr@example.com", full_name: "Dr. Anjali Sharma", role: "doctor", phone: null, is_active: true },
  admin: { id: "u3", email: "admin@caresync.app", full_name: "CareSync Admin", role: "admin", phone: null, is_active: true },
};
let currentRole = "patient";

vi.mock("../api/client", () => {
  const get = vi.fn(async (url) => {
    if (url === "/auth/me") return { data: USERS[currentRole] };
    if (url.endsWith("/available-slots")) return { data: SLOTS };
    if (url in FIXTURES) return { data: FIXTURES[url] };
    throw new Error(`Unmocked GET ${url}`);
  });
  const ok = vi.fn(async () => ({ data: {} }));
  return { default: { get, post: ok, put: ok, delete: ok }, errorMessage: (e) => String(e) };
});

import App from "../App.jsx";
import { AuthProvider } from "../AuthContext.jsx";
import { ToastProvider } from "../components/Toast.jsx";

const CASES = {
  patient: [
    ["/patient", /Asha/], ["/patient/find-doctors", /Find a doctor/], ["/patient/appointments", /Manage upcoming visits/],
    ["/patient/records", /Records & prescriptions/], ["/patient/notifications", /Notifications/], ["/patient/profile", /Personal information/],
  ],
  doctor: [
    ["/doctor", /Today's schedule/], ["/doctor/appointments", /All appointments/], ["/doctor/patients", /My patients/],
    ["/doctor/availability", /Weekly availability/], ["/doctor/notifications", /Notifications/], ["/doctor/account", /Password & security/],
  ],
  admin: [
    ["/admin", /Clinic overview/], ["/admin/appointments", /Every booking/], ["/admin/doctors", /Provision doctor accounts/],
    ["/admin/patients", /registered patients/], ["/admin/departments", /Group doctors/], ["/admin/account", /Password & security/],
  ],
};

describe.each(Object.entries(CASES))("%s pages render without crashing", (role, pages) => {
  beforeEach(() => { cleanup(); currentRole = role; localStorage.setItem("caresync_token", "t"); localStorage.removeItem("caresync_user"); });

  it.each(pages)("%s", async (path, expected) => {
    const errors = [];
    const spy = vi.spyOn(console, "error").mockImplementation((...a) => errors.push(a.join(" ")));
    render(
      <MemoryRouter initialEntries={[path]}>
        <ToastProvider><AuthProvider><App /></AuthProvider></ToastProvider>
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getAllByText(expected).length).toBeGreaterThan(0), { timeout: 4000 });
    // React logs real runtime problems (bad hooks, undefined props, missing keys) via console.error
    const real = errors.filter((e) => !/ResponsiveContainer|width\(0\)|act\(/i.test(e));
    spy.mockRestore();
    expect(real, real.join("\n")).toEqual([]);
  });
});

describe("routing guards", () => {
  it("sends a patient who opens an admin URL back to their own dashboard", async () => {
    cleanup(); currentRole = "patient"; localStorage.setItem("caresync_token", "t");
    render(<MemoryRouter initialEntries={["/admin"]}><ToastProvider><AuthProvider><App /></AuthProvider></ToastProvider></MemoryRouter>);
    await waitFor(() => expect(screen.getAllByText(/Here's a snapshot of your care/).length).toBeGreaterThan(0));
  });
  it("shows the login page when signed out", async () => {
    cleanup(); localStorage.clear();
    render(<MemoryRouter initialEntries={["/patient"]}><ToastProvider><AuthProvider><App /></AuthProvider></ToastProvider></MemoryRouter>);
    await waitFor(() => expect(screen.getAllByText(/Welcome back/).length).toBeGreaterThan(0));
  });
});
