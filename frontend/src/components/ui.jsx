import { useEffect } from "react";
import { X, Inbox } from "lucide-react";
import { initials, colorFor, riskLevel, STATUS_LABEL } from "../utils";

export function Avatar({ name, size = "md" }) {
  const cls = size === "lg" ? "avatar avatar-lg" : size === "sm" ? "avatar avatar-sm" : "avatar";
  return <div className={cls} style={{ background: colorFor(name) }} aria-hidden="true">{initials(name)}</div>;
}

export function StatusBadge({ status }) {
  return <span className={`badge badge-dot badge-${status}`}>{STATUS_LABEL[status] || status}</span>;
}

export function RiskBadge({ score }) {
  const level = riskLevel(score);
  if (!level) return null;
  const label = { low: "Low", medium: "Medium", high: "High" }[level];
  return (
    <span className={`badge badge-risk-${level}`} title="AI-estimated scheduling risk (not a medical assessment)">
      {label} no-show risk · {Math.round(score * 100)}%
    </span>
  );
}

export function StatCard({ icon: Icon, label, value, tone = "teal", loading }) {
  return (
    <div className="card stat">
      <div className={`stat-icon tone-${tone}`}><Icon size={22} /></div>
      <div>
        {loading ? <div className="skeleton" style={{ width: 54, height: 28, marginBottom: 4 }} /> : <div className="stat-value">{value}</div>}
        <div className="stat-label">{label}</div>
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children && <div className="row wrap">{children}</div>}
    </div>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, text, action }) {
  return (
    <div className="empty">
      <div className="empty-icon"><Icon size={24} /></div>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function SkeletonRows({ rows = 3, height = 56 }) {
  return (
    <div className="stack" style={{ padding: "1rem 1.25rem" }}>
      {Array.from({ length: rows }).map((_, i) => <div key={i} className="skeleton" style={{ height }} />)}
    </div>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} className={`tab ${value === t.id ? "active" : ""}`} onClick={() => onChange(t.id)}>
          {t.label}
          {t.count != null && <span className="tab-count">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Modal({ title, subtitle, onClose, children, footer, large, drawer }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  const body = (
    <>
      <div className="modal-head">
        <div>
          <h2>{title}</h2>
          {subtitle && <p className="muted small" style={{ marginTop: 4 }}>{subtitle}</p>}
        </div>
        <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label="Close"><X size={18} /></button>
      </div>
      <div className="modal-body" style={drawer ? { flex: 1 } : undefined}>{children}</div>
      {footer && <div className="modal-foot">{footer}</div>}
    </>
  );
  return (
    <div className={`overlay ${drawer ? "drawer-overlay" : ""}`} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      {drawer
        ? <div className="drawer" role="dialog" aria-modal="true" aria-label={title}>{body}</div>
        : <div className={`modal ${large ? "modal-lg" : ""}`} role="dialog" aria-modal="true" aria-label={title}>{body}</div>}
    </div>
  );
}

export function ConfirmDialog({ title, message, confirmLabel = "Confirm", danger, busy, onConfirm, onClose }) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={busy}>Keep it</button>
          <button className={`btn ${danger ? "btn-danger-solid" : "btn-primary"}`} onClick={onConfirm} disabled={busy}>
            {busy ? "Working…" : confirmLabel}
          </button>
        </>
      }
    >
      <p className="muted">{message}</p>
    </Modal>
  );
}
