import { useEffect, useMemo, useState } from "react";
import { Search, Users } from "lucide-react";
import api from "../../api/client";
import { Avatar, EmptyState, PageHeader, SkeletonRows } from "../../components/ui.jsx";
import { calcAge } from "../../utils";

export default function AdminPatients() {
  const [patients, setPatients] = useState(null);
  const [appts, setAppts] = useState([]);
  const [q, setQ] = useState("");
  useEffect(() => { api.get("/patients").then((r) => setPatients(r.data)); api.get("/appointments").then((r) => setAppts(r.data)); }, []);

  const stats = useMemo(() => {
    const m = {};
    appts.forEach((a) => { const s = (m[a.patient_id] ||= { total: 0, noShow: 0 }); s.total++; if (a.status === "no_show") s.noShow++; });
    return m;
  }, [appts]);
  const rows = (patients || []).filter((p) => !q || `${p.full_name} ${p.email}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <PageHeader title="Patients" subtitle="All registered patients and their activity." />
      <div className="search mb-2" style={{ maxWidth: 360 }}><Search size={16} /><input className="input" placeholder="Search by name or email" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="card card-flush">
        {!patients ? <SkeletonRows /> : rows.length === 0 ? <EmptyState icon={Users} title="No patients found" /> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Patient</th><th>Age</th><th>Gender</th><th>Blood group</th><th>Appointments</th><th>No-shows</th></tr></thead>
            <tbody>{rows.map((p) => (
              <tr key={p.id}>
                <td><div className="row"><Avatar name={p.full_name} size="sm" /><div><strong>{p.full_name}</strong><div className="faint small">{p.email}</div></div></div></td>
                <td>{calcAge(p.date_of_birth) ?? "—"}</td><td>{p.gender || "—"}</td><td>{p.blood_group || "—"}</td>
                <td>{stats[p.id]?.total || 0}</td><td>{stats[p.id]?.noShow || 0}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </div>
    </>
  );
}
