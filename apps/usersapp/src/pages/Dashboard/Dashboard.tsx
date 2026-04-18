import { useState } from "react";
import { useNavigate } from "react-router";
import { authClient } from "../../lib/auth-client";
import "./Dashboard.css";

const API_URL = import.meta.env.VITE_API_URL ?? "";

export default function Dashboard() {
  const { data: session } = authClient.useSession();
  const navigate = useNavigate();
  const [verifyResult, setVerifyResult] = useState<string | null>(null);

  async function handleSignOut(): Promise<void> {
    await authClient.signOut();
    navigate("/login");
  }

  async function handleVerify(): Promise<void> {
    setVerifyResult(null);
    try {
      const { data: tokenData } = await authClient.token();
      if (!tokenData?.token) {
        setVerifyResult("Not OK — failed to get JWT");
        return;
      }

      const res = await fetch(`${API_URL}/api/verify`, {
        headers: { Authorization: `Bearer ${tokenData.token}` },
      });

      if (res.ok) {
        const body = await res.json();
        setVerifyResult(body.status);
      } else {
        setVerifyResult("Not OK");
      }
    } catch {
      setVerifyResult("Not OK — request failed");
    }
  }

  return (
    <div className="dashboard">
      <div className="dashboard-card">
        <h2>Welcome back</h2>
        <p className="dashboard-username">{session?.user.name}</p>
        <button className="dashboard-verify" onClick={handleVerify}>
          Verify JWT
        </button>
        {verifyResult && (
          <p className={`verify-result ${verifyResult === "OK" ? "verify-ok" : "verify-fail"}`}>
            {verifyResult}
          </p>
        )}
        <button className="dashboard-signout" onClick={handleSignOut}>
          Sign Out
        </button>
      </div>
    </div>
  );
}
