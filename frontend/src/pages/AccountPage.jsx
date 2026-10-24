import { useAuth } from "../AuthContext.jsx";
import { Avatar, PageHeader } from "../components/ui.jsx";
import PasswordCard from "../components/PasswordCard.jsx";

export default function AccountPage() {
  const { user } = useAuth();
  return (
    <>
      <PageHeader title="Account" subtitle="Your sign-in details and security." />
      <div className="grid-2-even">
        <div className="card card-pad">
          <div className="row" style={{ gap: "1rem" }}>
            <Avatar name={user.full_name} size="lg" />
            <div><h2>{user.full_name}</h2><p className="muted" style={{ textTransform: "capitalize" }}>{user.role}</p></div>
          </div>
          <dl className="kv mt-3">
            <dt>Email</dt><dd>{user.email}</dd>
            <dt>Phone</dt><dd>{user.phone || "—"}</dd>
            <dt>Status</dt><dd>{user.is_active ? "Active" : "Deactivated"}</dd>
          </dl>
        </div>
        <PasswordCard />
      </div>
    </>
  );
}
