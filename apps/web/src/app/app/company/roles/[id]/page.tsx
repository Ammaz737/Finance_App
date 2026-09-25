"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@finance/design-system";
import { api } from "@/lib/api";
type Detail = { role: { name: string; description: string }; permissions: Array<{ id: string; key: string; label: string; scope: string }>; entityRestrictions: string[] };
export default function RoleDetailPage() { const { id } = useParams<{ id: string }>(); const detail = useQuery({ queryKey: ["role", id], queryFn: () => api.get<Detail>(`/rbac/${id}`) }); if (detail.isPending || !detail.data) return <p className="muted">Loading role…</p>; return <div className="stack-lg"><div className="resource-heading"><PageHeader title={detail.data.role.name} subtitle={detail.data.role.description || "Role permissions and scope"} /><Link className="btn btn-ghost" href="/app/company/roles">Back</Link></div><section className="panel"><h2>Permissions</h2><ul className="plain-list">{detail.data.permissions.map((permission) => <li key={permission.id}><code>{permission.key}</code> · {permission.label} · scope {permission.scope}</li>)}</ul></section><section className="panel"><h2>Entity restrictions</h2><p>{detail.data.entityRestrictions.length ? detail.data.entityRestrictions.join(", ") : "Organization-wide or not currently assigned."}</p><p className="muted">Advanced custom-role authoring remains outside P0.5; existing roles can be assigned or removed from People.</p></section></div>; }
