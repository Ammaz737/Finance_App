"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, setToken } from "@/lib/api";
import { Button, Input, PageHeader } from "@finance/design-system";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [workspace, setWorkspace] = useState("");
  const [error, setError] = useState("");
  const [expired, setExpired] = useState(false);

  useEffect(() => setExpired(new URLSearchParams(window.location.search).get("reason") === "session-expired"), []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const result = await api.post<{ token: string }>("/identity/login", { email, password, ...(workspace.trim() ? { workspace: workspace.trim().toLowerCase() } : {}) });
      setToken(result.token);
      router.push("/app/home");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    }
  }

  return (
    <main className="login-shell">
      <PageHeader title="Finance" subtitle="On-premises financial operations" />
      {expired && <p className="notice" role="status">Your session expired. Please sign in again.</p>}
      <form className="login-form" onSubmit={onSubmit}>
        <label>
          Workspace <span className="muted">(if your email belongs to multiple companies)</span>
          <Input value={workspace} onChange={(event) => setWorkspace(event.target.value)} autoComplete="organization" />
        </label>
        <label>
          Email
          <Input value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <label>
          Password
          <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
        {error ? <p className="error">{error}</p> : null}
        <Button type="submit">Sign in</Button>
        <Link href="/forgot-password">Forgot password?</Link>
      </form>
    </main>
  );
}
