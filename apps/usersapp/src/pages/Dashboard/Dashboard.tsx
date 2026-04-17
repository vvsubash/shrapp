import { Navigate, useNavigate } from "react-router";
import { authClient } from "../../lib/auth-client";
import "./Dashboard.css";

export default function Dashboard() {
  const { data: session, isPending } = authClient.useSession();
  const navigate = useNavigate();

  if (isPending) {
    return <div className="dashboard">Loading…</div>;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  async function handleSignOut(): Promise<void> {
    await authClient.signOut();
    navigate("/login");
  }

  return (
    <div className="dashboard">
      <div className="dashboard-card">
        <h2>Welcome back</h2>
        <p className="dashboard-username">{session.user.name}</p>
        <button className="dashboard-signout" onClick={handleSignOut}>
          Sign Out
        </button>
      </div>
    </div>
  );
}
