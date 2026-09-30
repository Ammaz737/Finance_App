"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { type Column } from "@finance/design-system";
import { canSeeItem, findNavItem } from "@/config/navigation";
import { ResourcePage } from "@/components/ResourcePage";
import { api } from "@/lib/api";
import { useSession } from "@/providers/session-provider";

type AuditRow = {
  id: string;
  createdAt?: string;
  actorId?: string;
  action?: string;
  objectType?: string;
  objectId?: string;
};

type Person = { id: string; firstName?: string; lastName?: string; email?: string };

function actorLabel(people: Person[], id?: string) {
  if (!id) return "System";
  const person = people.find((row) => row.id === id);
  if (!person) return id.slice(0, 8);
  const name = `${person.firstName ?? ""} ${person.lastName ?? ""}`.trim();
  return name || person.email || id.slice(0, 8);
}

export default function Page() {
  const session = useSession();
  const canSeePeople = session
    ? canSeeItem(findNavItem("/app/company/people") ?? { href: "/app/company/people", permission: "people.read" }, session)
    : false;
  const canSeeIntegrations = session
    ? canSeeItem(
        findNavItem("/app/company/integrations") ?? { href: "/app/company/integrations", permission: "report.read" },
        session,
      )
    : false;

  const people = useQuery({
    queryKey: ["audit-actor-labels"],
    queryFn: async () => {
      try {
        return await api.get<Person[]>("/people");
      } catch {
        return [] as Person[];
      }
    },
  });
  const peopleRows = people.data ?? [];

  const columns: Column<AuditRow>[] = [
    {
      key: "createdAt",
      header: "When",
      render: (row) => (row.createdAt ? new Date(row.createdAt).toLocaleString() : "—"),
    },
    {
      key: "actorId",
      header: "Actor",
      render: (row) => actorLabel(peopleRows, row.actorId),
    },
    {
      key: "action",
      header: "Action",
      render: (row) => <code>{row.action || "—"}</code>,
    },
    {
      key: "object",
      header: "Object",
      render: (row) => (
        <span className="inbox-table-request">
          <strong>{row.objectType || "—"}</strong>
          <small>{row.objectId ? row.objectId.slice(0, 12) : "—"}</small>
        </span>
      ),
    },
  ];

  return (
    <div className="company-audit-page linked-dest-page">
      <ResourcePage title="Audit log" path="audit" columns={columns} pageSize={25} />
      <p className="muted my-expenses-hint">
        Chronological material changes across the organization.{" "}
        {canSeePeople && (
          <Link className="detail-link" href="/app/company/people">
            People →
          </Link>
        )}{" "}
        {canSeeIntegrations && (
          <Link className="detail-link" href="/app/company/integrations">
            Integrations →
          </Link>
        )}
      </p>
    </div>
  );
}
