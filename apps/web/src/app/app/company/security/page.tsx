"use client";

import { FormEvent, useState } from "react";
import { PageHeader } from "@finance/design-system";
import { api } from "@/lib/api";

export default function SecurityPage() {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [message, setMessage] = useState(""); const [error, setError] = useState(""); const [pending, setPending] = useState(false);
  async function submit(event: FormEvent) { event.preventDefault(); setMessage(""); setError(""); if (form.newPassword !== form.confirm) return setError("Passwords do not match."); setPending(true);
    try { await api.post("/identity/change-password", { currentPassword: form.currentPassword, newPassword: form.newPassword }); setForm({ currentPassword: "", newPassword: "", confirm: "" }); setMessage("Password changed. Other sessions were signed out."); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Password change failed"); } finally { setPending(false); }
  }
  return <div className="stack-lg"><PageHeader title="Security" subtitle="Manage your sign-in credentials." /><section className="panel"><h2>Change password</h2><form className="record-form" onSubmit={submit}>
    <label>Current password<input className="input" type="password" value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} required /></label>
    <label>New password<input className="input" type="password" minLength={12} value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} required /></label>
    <label>Confirm password<input className="input" type="password" minLength={12} value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} required /></label>
    <p className="muted">Use at least 12 characters with uppercase, lowercase, and a number.</p>{message && <p className="notice">{message}</p>}{error && <p className="error" role="alert">{error}</p>}
    <button className="btn btn-primary" disabled={pending} type="submit">{pending ? "Changing…" : "Change password"}</button>
  </form></section></div>;
}
