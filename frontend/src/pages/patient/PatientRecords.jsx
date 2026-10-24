import { useEffect, useState } from "react";
import { FileText, Pill, Printer } from "lucide-react";
import api from "../../api/client";
import { EmptyState, PageHeader, SkeletonRows, Tabs } from "../../components/ui.jsx";
import { formatDate } from "../../utils";

export default function PatientRecords() {
  const [tab, setTab] = useState("rx");
  const [records, setRecords] = useState(null);
  const [rx, setRx] = useState(null);

  useEffect(() => {
    api.get("/patients/me").then((p) => {
      api.get(`/medical-records/${p.data.id}`).then((r) => setRecords(r.data));
      api.get(`/prescriptions/patient/${p.data.id}`).then((r) => setRx(r.data));
    });
  }, []);

  return (
    <>
      <PageHeader title="Records & prescriptions" subtitle="Everything your doctors have added to your chart." />
      <Tabs value={tab} onChange={setTab} tabs={[
        { id: "rx", label: "Prescriptions", count: rx?.length },
        { id: "rec", label: "Medical records", count: records?.length },
      ]} />
      {tab === "rx" ? (
        !rx ? <div className="card"><SkeletonRows /></div> : rx.length === 0 ? (
          <div className="card"><EmptyState icon={Pill} title="No prescriptions yet" text="Prescriptions from your visits will appear here." /></div>
        ) : rx.map((p) => (
          <div className="rx-item card" key={p.id}>
            <div className="rx-head">
              <div><strong>Prescription</strong><div className="muted small">Issued {formatDate(p.created_at.slice(0, 10))}</div></div>
              <button className="btn btn-secondary btn-sm no-print" onClick={() => window.print()}><Printer size={15} /> Print</button>
            </div>
            {p.notes && <p style={{ padding: ".75rem 1rem 0" }} className="muted">{p.notes}</p>}
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Medicine</th><th>Dosage</th><th>Frequency</th><th>Duration</th><th>Instructions</th></tr></thead>
                <tbody>{p.items.map((i) => (
                  <tr key={i.id}><td><strong>{i.medicine_name}</strong></td><td>{i.dosage}</td><td>{i.frequency}</td><td>{i.duration_days} days</td><td className="muted">{i.instructions || "—"}</td></tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        ))
      ) : (
        <div className="card card-flush">
          {!records ? <SkeletonRows /> : records.length === 0 ? (
            <EmptyState icon={FileText} title="No records yet" text="Notes your doctors add to your chart will appear here." />
          ) : records.map((r) => (
            <div className="list-item" key={r.id}>
              <div className="stat-icon tone-teal" style={{ width: 38, height: 38 }}><FileText size={18} /></div>
              <div className="grow">
                <div className="row-between"><strong style={{ textTransform: "capitalize" }}>{r.record_type.replace(/_/g, " ")}</strong><span className="faint small">{formatDate(r.created_at.slice(0, 10))}</span></div>
                <p className="muted" style={{ marginTop: 2 }}>{r.notes}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
