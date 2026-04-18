import { useNavigate } from "react-router";
import { authClient } from "../../lib/auth-client";
import "./Dashboard.css";

export default function Dashboard() {
  const { data: session } = authClient.useSession();
  const navigate = useNavigate();

  async function handleSignOut(): Promise<void> {
    await authClient.signOut();
    navigate("/login");
  }

  return (
    <div className="dashboard">
      <div className="dashboard-card">
        <h2>Welcome back</h2>
        <p className="dashboard-username">{session?.user.name}</p>
        <button className="dashboard-signout" onClick={handleSignOut}>
          Sign Out
        </button>
      </div>
    </div>
  );
}
