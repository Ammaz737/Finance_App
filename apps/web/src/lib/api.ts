import { createApiClient } from "@finance/api-client";

const TOKEN_KEY = "finance.token";

export function getToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
}

export const api = createApiClient("/api/v1", getToken, () => {
  if (typeof window === "undefined") return;
  setToken(null);
  if (!window.location.pathname.startsWith("/login")) window.location.assign("/login?reason=session-expired");
});
