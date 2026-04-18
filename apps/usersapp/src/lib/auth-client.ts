import { createAuthClient } from "better-auth/react";
import { usernameClient } from "better-auth/client/plugins";
import { jwtClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  // In dev, Vite proxies /api/auth → localhost:8787
  // In prod, set this to the auth service URL
  baseURL: import.meta.env.VITE_AUTH_URL ?? "",
  plugins: [usernameClient(), jwtClient()],
});
