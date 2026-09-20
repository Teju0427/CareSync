import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/client";
import { useAuth } from "../../AuthContext.jsx";
import StatusPill from "../../components/StatusPill.jsx";

export default function PatientHome() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/appointments").then((res) => setAppointments(res.data)).finally(() => setLoading(false));
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = appointments
    .filter((a) => a.appointment_date >= today && a.status !== "cancelled")
    .slice(0, 5);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Welcome back, {user?.full_name?.split(" ")[0]}</h1>
          <p>Here's what's next on your care schedule.</p>
        </div>
        <Link className="btn btn-primary" to="/patient/find-doctors">
          Book an appointment
        </Link>
      </div>

      <div className="panel">
        <h3>Upcoming appointments</h3>
        {loading ? (
          <p>Loading…</p>
        ) : upcoming.length === 0 ? (
          <div className="empty-state">
            No upcoming appointments yet. Find a doctor to book your first visit.
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Doctor</th>
                <th>Date</th>
                <th>Time</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {upcoming.map((a) => (
                <tr key={a.id}>
                  <td>{a.doctor_name}</td>
                  <td>{a.appointment_date}</td>
                  <td>{a.appointment_time}</td>
                  <td><StatusPill status={a.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
