"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { api } from "@/lib/api";
import { Button, Input, PageHeader } from "@finance/design-system";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState(""); const [workspace, setWorkspace] = useState("");
  const [error, setError] = useState(""); const [sent, setSent] = useState(false); const [sandboxPath, setSandboxPath] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault(); setError("");
    try {
      const result = await api.post<{ accepted: boolean; sandboxResetPath?: string }>("/identity/forgot-password", { email, workspace });
      setSandboxPath(result.sandboxResetPath ?? ""); setSent(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Request failed"); }
  }
  return <main className="login-shell"><PageHeader title="Reset your password" subtitle="Request a single-use password reset link." />
    <form className="login-form" onSubmit={submit}>
      <label>Workspace<Input value={workspace} onChange={(e) => setWorkspace(e.target.value)} required /></label>
      <label>Email<Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
      {sent && <p className="notice">If the account exists, a reset link has been issued.</p>}
      {sandboxPath && <div className="policy-box"><strong>Sandbox delivery</strong><p>Email is not configured. Copy this reset link for the user.</p><button type="button" className="btn btn-ghost" onClick={() => void navigator.clipboard.writeText(`${window.location.origin}${sandboxPath}`)}>Copy reset link</button> <Link href={sandboxPath}>Open link</Link></div>}
      {error && <p className="error" role="alert">{error}</p>}<Button type="submit">Send reset link</Button><Link href="/login">Back to sign in</Link>
    </form></main>;
}
