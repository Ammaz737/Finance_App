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
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    setExpired(query.get("reason") === "session-expired");
    const nextWorkspace = query.get("workspace");
    const nextEmail = query.get("email");
    if (nextWorkspace) setWorkspace(nextWorkspace);
    if (nextEmail) setEmail(nextEmail);
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const result = await api.post<{ token: string }>("/identity/login", {
        email,
        password,
        ...(workspace.trim() ? { workspace: workspace.trim().toLowerCase() } : {}),
      });
      setToken(result.token);
      router.push("/app/home");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-shell">
      <PageHeader title="Finance" subtitle="On-premises financial operations" />
      {expired && (
        <p className="notice" role="status">
          Your session expired. Please sign in again.
        </p>
      )}
      <form className="login-form" onSubmit={onSubmit}>
        <label>
          Workspace <span className="muted">(if your email belongs to multiple companies)</span>
          <Input
            value={workspace}
            onChange={(event) => setWorkspace(event.target.value)}
            autoComplete="organization"
          />
        </label>
        <label>
          Email
          <Input value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" />
        </label>
        <label>
          Password
          <Input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
          />
        </label>
        {error ? <p className="error">{error}</p> : null}
        <Button type="submit" disabled={submitting}>
          {submitting ? "Signing in…" : "Sign in"}
        </Button>
        <Link href="/forgot-password">Forgot password?</Link>
      </form>
    </main>
  );
}
