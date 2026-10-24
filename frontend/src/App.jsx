import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./AuthContext.jsx";
import Shell from "./components/Shell.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import NotificationsPage from "./pages/NotificationsPage.jsx";
import AccountPage from "./pages/AccountPage.jsx";

import PatientHome from "./pages/patient/PatientHome.jsx";
import FindDoctors from "./pages/patient/FindDoctors.jsx";
import PatientAppointments from "./pages/patient/PatientAppointments.jsx";
import PatientRecords from "./pages/patient/PatientRecords.jsx";
import PatientProfile from "./pages/patient/PatientProfile.jsx";

import DoctorHome from "./pages/doctor/DoctorHome.jsx";
import DoctorAppointments from "./pages/doctor/DoctorAppointments.jsx";
import DoctorPatients from "./pages/doctor/DoctorPatients.jsx";
import DoctorAvailability from "./pages/doctor/DoctorAvailability.jsx";

import AdminHome from "./pages/admin/AdminHome.jsx";
import AdminAppointments from "./pages/admin/AdminAppointments.jsx";
import AdminDoctors from "./pages/admin/AdminDoctors.jsx";
import AdminPatients from "./pages/admin/AdminPatients.jsx";
import AdminDepartments from "./pages/admin/AdminDepartments.jsx";

function RequireRole({ role, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role) return <Navigate to={`/${user.role}`} replace />;
  return children;
}

export default function App() {
  const { user, loading } = useAuth();
  // Wait for the session check before routing, otherwise we redirect with an unknown role.
  if (loading) return <div className="empty" style={{ paddingTop: "30vh" }}>Loading CareSync…</div>;
  const home = user?.role ? `/${user.role}` : "/login";

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={home} replace /> : <LoginPage />} />

      <Route path="/patient" element={<RequireRole role="patient"><Shell /></RequireRole>}>
        <Route index element={<PatientHome />} />
        <Route path="find-doctors" element={<FindDoctors />} />
        <Route path="appointments" element={<PatientAppointments />} />
        <Route path="records" element={<PatientRecords />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="profile" element={<PatientProfile />} />
      </Route>

      <Route path="/doctor" element={<RequireRole role="doctor"><Shell /></RequireRole>}>
        <Route index element={<DoctorHome />} />
        <Route path="appointments" element={<DoctorAppointments />} />
        <Route path="patients" element={<DoctorPatients />} />
        <Route path="availability" element={<DoctorAvailability />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="account" element={<AccountPage />} />
      </Route>

      <Route path="/admin" element={<RequireRole role="admin"><Shell /></RequireRole>}>
        <Route index element={<AdminHome />} />
        <Route path="appointments" element={<AdminAppointments />} />
        <Route path="doctors" element={<AdminDoctors />} />
        <Route path="patients" element={<AdminPatients />} />
        <Route path="departments" element={<AdminDepartments />} />
        <Route path="account" element={<AccountPage />} />
      </Route>

      <Route path="*" element={<Navigate to={home} replace />} />
    </Routes>
  );
}
