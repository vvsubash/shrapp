import { Navigate, Outlet } from "react-router";
import { authClient } from "../lib/auth-client";

export default function GuestRoute() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return <div>Loading…</div>;
  }

  if (session) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
