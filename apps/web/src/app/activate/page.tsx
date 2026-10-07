"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Button, Input, PageHeader } from "@finance/design-system";

const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{12,128}$/;

export default function ActivatePage() {
  const [form, setForm] = useState({ token: "", email: "", workspace: "", password: "", confirm: "" });
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    setForm((value) => ({
      ...value,
      token: query.get("token") ?? "",
      email: query.get("email") ?? "",
      workspace: query.get("workspace") ?? "",
    }));
  }, []);

  const loginHref = useMemo(() => {
    const params = new URLSearchParams();
    if (form.workspace) params.set("workspace", form.workspace);
    if (form.email) params.set("email", form.email);
    const query = params.toString();
    return query ? `/login?${query}` : "/login";
  }, [form.email, form.workspace]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!form.token.trim()) {
      setError("Activation token is missing. Open the invite link from your email or sandbox delivery.");
      return;
    }
    if (form.password !== form.confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (!PASSWORD_RULE.test(form.password)) {
      setError("Password needs 12+ characters with mixed case and a number.");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/identity/activate", {
        token: form.token,
        email: form.email,
        workspace: form.workspace,
        password: form.password,
      });
      setDone(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Activation failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-shell">
      <PageHeader title="Activate your account" subtitle="Set a password to finish your invitation." />
      {done ? (
        <div className="login-form">
          <p className="notice">Your account is active.</p>
          <Link className="btn btn-primary" href={loginHref}>
            Sign in
          </Link>
        </div>
      ) : (
        <form className="login-form" onSubmit={submit}>
          <label>
            Workspace
            <Input
              value={form.workspace}
              onChange={(e) => setForm({ ...form, workspace: e.target.value })}
              required
              autoComplete="organization"
            />
          </label>
          <label>
            Email
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              autoComplete="email"
            />
          </label>
          <label>
            New password
            <Input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              minLength={12}
              required
              autoComplete="new-password"
            />
          </label>
          <label>
            Confirm password
            <Input
              type="password"
              value={form.confirm}
              onChange={(e) => setForm({ ...form, confirm: e.target.value })}
              minLength={12}
              required
              autoComplete="new-password"
            />
          </label>
          <p className="muted">Use at least 12 characters with upper and lowercase letters and a number.</p>
          {error ? (
            <p className="error" role="alert">
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={submitting}>
            {submitting ? "Activating…" : "Activate account"}
          </Button>
        </form>
      )}
    </main>
  );
}
