export default function StatusPill({ status }) {
  const label = status.replace("_", " ");
  return <span className={`status-pill status-${status}`}>{label}</span>;
}
