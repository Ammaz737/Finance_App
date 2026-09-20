"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api, getToken } from "@/lib/api";

export type Session = {
  userId: string;
  organizationId: string;
  entityIds: string[];
  roles: string[];
  permissions: string[];
  entitlements: string[];
  user: { id: string; email: string; firstName: string; lastName: string; status: string };
};

const SessionContext = createContext<Session | null>(null);

export function useSession() {
  return useContext(SessionContext);
}

export function SessionGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [token, setToken] = useState<string | null | undefined>(undefined);
  useEffect(() => setToken(getToken()), []);
  const session = useQuery({
    queryKey: ["session"],
    queryFn: () => api.get<Session>("/identity/me"),
    enabled: Boolean(token),
    retry: false,
  });

  useEffect(() => {
    if (token === null || (token && session.isError)) router.replace("/login");
  }, [token, session.isError, router]);

  if (!token || session.isPending) {
    return <div className="loading-screen" role="status">Loading your workspace…</div>;
  }
  if (session.isError || !session.data) {
    return <div className="loading-screen" role="status">Opening sign in…</div>;
  }
  return <SessionContext.Provider value={session.data}>{children}</SessionContext.Provider>;
}
