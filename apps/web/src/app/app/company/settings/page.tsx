"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@finance/design-system";
import { api } from "@/lib/api";
import { useSession } from "@/providers/session-provider";

type Organization = { id: string; name: string; slug: string; createdAt: string };

export default function Page() {
  const session = useSession();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const organizations = useQuery({ queryKey: ["organizations"], queryFn: () => api.get<Organization[]>("/organizations") });
  const organization = organizations.data?.[0];
  const save = useMutation({
    mutationFn: (nextName: string) => api.request<Organization>(`/organizations/${organization?.id}`, { method: "PATCH", body: JSON.stringify({ name: nextName }) }),
    onSuccess: () => { setName(""); void queryClient.invalidateQueries({ queryKey: ["organizations"] }); },
  });
  const editable = session?.roles.includes("Owner") ?? false;
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (organization && name.trim().length >= 2) save.mutate(name.trim());
  }

  return <div className="settings-page">
    <PageHeader title="Company settings" subtitle="Organization identity and the structure used across spend, approvals, and accounting." />
    {organizations.isError && <p className="error-panel">Could not load company settings.</p>}
    {organizations.isPending && <p className="muted">Loading company settings…</p>}
    {organization && <>
      <section className="settings-card">
        <h2>Organization</h2>
        <dl className="detail-list"><div><dt>Name</dt><dd>{organization.name}</dd></div><div><dt>Workspace</dt><dd>{organization.slug}</dd></div><div><dt>Created</dt><dd>{new Date(organization.createdAt).toLocaleDateString()}</dd></div></dl>
        {editable && <form className="record-form" onSubmit={submit}><label>Update organization name<input className="input" minLength={2} maxLength={120} value={name} onChange={(event) => setName(event.target.value)} placeholder={organization.name} required /></label>{save.isError && <p className="error" role="alert">{save.error.message}</p>}{save.isSuccess && <p className="notice" role="status">Company name saved.</p>}<button className="btn btn-primary" disabled={save.isPending} type="submit">{save.isPending ? "Saving…" : "Save name"}</button></form>}
      </section>
      <section className="settings-card"><h2>Company structure</h2><p className="muted">Legal entities determine currency and country controls. Departments and locations organize people and reporting.</p><div className="settings-links"><Link href="/app/company/entities">Legal entities →</Link><Link href="/app/company/departments">Departments →</Link><Link href="/app/company/locations">Locations →</Link><Link href="/app/company/people">People →</Link></div></section>
    </>}
  </div>;
}
