"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button, Input, PageHeader } from "@finance/design-system";

export default function ActivatePage() {
  const [form, setForm] = useState({ token: "", email: "", workspace: "", password: "", confirm: "" });
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    setForm((value) => ({ ...value, token: query.get("token") ?? "", email: query.get("email") ?? "", workspace: query.get("workspace") ?? "" }));
  }, []);
  async function submit(event: FormEvent) {
    event.preventDefault(); setError("");
    if (form.password !== form.confirm) return setError("Passwords do not match.");
    try {
      await api.post("/identity/activate", { token: form.token, email: form.email, workspace: form.workspace, password: form.password });
      setDone(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Activation failed"); }
  }
  return <main className="login-shell"><PageHeader title="Activate your account" subtitle="Set a password to finish your invitation." />
    {done ? <div className="login-form"><p className="notice">Your account is active.</p><Link className="btn btn-primary" href="/login">Sign in</Link></div> :
      <form className="login-form" onSubmit={submit}>
        <label>Workspace<Input value={form.workspace} onChange={(e) => setForm({ ...form, workspace: e.target.value })} required /></label>
        <label>Email<Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label>
        <label>New password<Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} minLength={12} required /></label>
        <label>Confirm password<Input type="password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} minLength={12} required /></label>
        {error && <p className="error" role="alert">{error}</p>}<Button type="submit">Activate account</Button>
      </form>}
  </main>;
}
