import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./AuthContext.jsx";
import Shell from "./components/Shell.jsx";
import LoginPage from "./pages/LoginPage.jsx";

import PatientHome from "./pages/patient/PatientHome.jsx";
import FindDoctors from "./pages/patient/FindDoctors.jsx";
import PatientAppointments from "./pages/patient/PatientAppointments.jsx";
import PatientRecords from "./pages/patient/PatientRecords.jsx";
import PatientProfile from "./pages/patient/PatientProfile.jsx";
import NotificationsPage from "./pages/NotificationsPage.jsx";

import DoctorHome from "./pages/doctor/DoctorHome.jsx";
import DoctorPatients from "./pages/doctor/DoctorPatients.jsx";
import DoctorAvailability from "./pages/doctor/DoctorAvailability.jsx";

import AdminHome from "./pages/admin/AdminHome.jsx";
import AdminDoctors from "./pages/admin/AdminDoctors.jsx";
import AdminDepartments from "./pages/admin/AdminDepartments.jsx";

function RequireRole({ role, children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="empty-state">Loading CareSync…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role) return <Navigate to={`/${user.role}`} replace />;
  return children;
}

export default function App() {
  const { user, loading } = useAuth();

  // Don't redirect anywhere until we actually know whether there's a
  // logged-in user — redirecting mid-check is what produces "/undefined".
  if (loading) {
    return <div className="empty-state">Loading CareSync…</div>;
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to={`/${user.role}`} replace /> : <LoginPage />}
      />

      <Route
        path="/patient"
        element={
          <RequireRole role="patient">
            <Shell />
          </RequireRole>
        }
      >
        <Route index element={<PatientHome />} />
        <Route path="find-doctors" element={<FindDoctors />} />
        <Route path="appointments" element={<PatientAppointments />} />
        <Route path="records" element={<PatientRecords />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="profile" element={<PatientProfile />} />
      </Route>

      <Route
        path="/doctor"
        element={
          <RequireRole role="doctor">
            <Shell />
          </RequireRole>
        }
      >
        <Route index element={<DoctorHome />} />
        <Route path="patients" element={<DoctorPatients />} />
        <Route path="availability" element={<DoctorAvailability />} />
        <Route path="notifications" element={<NotificationsPage />} />
      </Route>

      <Route
        path="/admin"
        element={
          <RequireRole role="admin">
            <Shell />
          </RequireRole>
        }
      >
        <Route index element={<AdminHome />} />
        <Route path="doctors" element={<AdminDoctors />} />
        <Route path="departments" element={<AdminDepartments />} />
      </Route>

      <Route
        path="*"
        element={<Navigate to={user?.role ? `/${user.role}` : "/login"} replace />}
      />
    </Routes>
  );
}
