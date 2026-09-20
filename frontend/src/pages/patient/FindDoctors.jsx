import { useEffect, useState } from "react";
import api from "../../api/client";

export default function FindDoctors() {
  const [departments, setDepartments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [departmentId, setDepartmentId] = useState("");
  const [search, setSearch] = useState("");
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [slots, setSlots] = useState([]);
  const [selectedTime, setSelectedTime] = useState(null);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    api.get("/admin/departments").then((res) => setDepartments(res.data));
  }, []);

  useEffect(() => {
    const params = {};
    if (departmentId) params.department_id = departmentId;
    if (search) params.search = search;
    api.get("/doctors", { params }).then((res) => setDoctors(res.data));
  }, [departmentId, search]);

  useEffect(() => {
    if (!selectedDoctor) return;
    setSelectedTime(null);
    api
      .get(`/doctors/${selectedDoctor.id}/available-slots`, { params: { for_date: date } })
      .then((res) => setSlots(res.data));
  }, [selectedDoctor, date]);

  async function bookAppointment() {
    setMessage("");
    try {
      await api.post("/appointments", {
        doctor_id: selectedDoctor.id,
        appointment_date: date,
        appointment_time: selectedTime,
        reason,
      });
      setMessage("Appointment booked. You'll find it under Appointments.");
      setSelectedTime(null);
      setReason("");
      const res = await api.get(`/doctors/${selectedDoctor.id}/available-slots`, { params: { for_date: date } });
      setSlots(res.data);
    } catch (err) {
      setMessage(err.response?.data?.detail || "Could not book that slot — please try another.");
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Find a doctor</h1>
          <p>Filter by department or search by name, then pick an open time.</p>
        </div>
      </div>

      <div className="filter-bar">
        <div className="field field-department">
          <label htmlFor="department">Department</label>
          <select id="department" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
            <option value="">All departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
        <div className="field field-search">
          <label htmlFor="doctor-search">Search by name</label>
          <input
            id="doctor-search"
            placeholder="e.g. Dr. Sharma"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="two-col">
        <div>
          {doctors.length === 0 ? (
            <div className="empty-state">No doctors match those filters yet.</div>
          ) : (
            <div className="doctor-grid">
              {doctors.map((doc) => (
                <div key={doc.id} className="doctor-card">
                  <h3>{doc.full_name}</h3>
                  <div className="dept">{doc.specialization}{doc.department_name ? ` · ${doc.department_name}` : ""}</div>
                  <p style={{ fontSize: "0.9rem" }}>{doc.bio || `${doc.years_experience} years of experience.`}</p>
                  <div className="fee">Consultation fee: ₹{doc.consultation_fee}</div>
                  <button className="btn btn-secondary" style={{ marginTop: "0.6rem" }} onClick={() => setSelectedDoctor(doc)}>
                    View availability
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="panel">
          {!selectedDoctor ? (
            <p>Select a doctor to see open slots.</p>
          ) : (
            <>
              <h3>{selectedDoctor.full_name}</h3>
              <div className="field">
                <label htmlFor="date">Date</label>
                <input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>

              {slots.length === 0 ? (
                <p style={{ color: "var(--color-muted)" }}>No open slots on this date. Try another day.</p>
              ) : (
                <div className="slot-grid">
                  {slots.map((s) => (
                    <button
                      key={s.time}
                      className={`slot-btn ${selectedTime === s.time ? "selected" : ""}`}
                      onClick={() => setSelectedTime(s.time)}
                    >
                      {s.time.slice(0, 5)}
                    </button>
                  ))}
                </div>
              )}

              {selectedTime && (
                <>
                  <div className="field">
                    <label htmlFor="reason">Reason for visit</label>
                    <textarea
                      id="reason"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="e.g. routine checkup, follow-up on last visit…"
                    />
                  </div>
                  <button className="btn btn-primary" onClick={bookAppointment}>
                    Confirm {selectedTime.slice(0, 5)} on {date}
                  </button>
                </>
              )}

              {message && <p style={{ marginTop: "0.75rem" }}>{message}</p>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
