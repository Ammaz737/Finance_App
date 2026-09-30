"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { StatusBadge, type Column } from "@finance/design-system";
import { canSeeItem, findNavItem } from "@/config/navigation";
import { ResourcePage } from "@/components/ResourcePage";
import { useSession } from "@/providers/session-provider";

type PersonRow = {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  status?: string;
  managerId?: string;
  createdAt?: string;
};

const focusLinks = [
  { href: "/app/company/people", label: "All", focus: null as string | null },
  { href: "/app/company/people?focus=active", label: "Active", focus: "active", statuses: ["ACTIVE"] },
  { href: "/app/company/people?focus=draft", label: "Draft / invite", focus: "draft", statuses: ["DRAFT"] },
  { href: "/app/company/people?focus=suspended", label: "Suspended", focus: "suspended", statuses: ["SUSPENDED"] },
];

function PeopleContent() {
  const router = useRouter();
  const search = useSearchParams();
  const session = useSession();
  const focus = search.get("focus");
  const active = focusLinks.find((item) => item.focus === focus) ?? focusLinks[0]!;

  const canEdit = Boolean(
    session?.roles.includes("Owner") ||
      session?.permissions.includes("*") ||
      session?.permissions.includes("people.edit"),
  );
  const canSeeRoles = session
    ? canSeeItem(findNavItem("/app/company/roles") ?? { href: "/app/company/roles", permission: "roles.assign" }, session)
    : false;
  const canSeeSettings = session
    ? canSeeItem(findNavItem("/app/company/settings") ?? { href: "/app/company/settings", permission: "roles.assign" }, session)
    : false;

  const columns: Column<PersonRow>[] = [
    {
      key: "name",
      header: "Person",
      render: (row) => (
        <span className="inbox-table-request">
          <strong>{`${row.firstName ?? ""} ${row.lastName ?? ""}`.trim() || "Person"}</strong>
          <small>{row.email || "No email"}</small>
        </span>
      ),
    },
    {
      key: "email",
      header: "Email",
      render: (row) => row.email || "—",
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge status={row.status ?? "UNKNOWN"} />,
    },
    {
      key: "createdAt",
      header: "Added",
      render: (row) => (row.createdAt ? new Date(row.createdAt).toLocaleDateString() : "—"),
    },
    {
      key: "open",
      header: "",
      render: () => <span className="detail-link">Open →</span>,
    },
  ];

  return (
    <div className="company-people-page linked-dest-page">
      <div className="my-work-filters" role="toolbar" aria-label="People focus">
        {focusLinks.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`chip${item.focus === active.focus ? " chip-active" : ""}`}
          >
            {item.label}
          </Link>
        ))}
      </div>

      <ResourcePage
        title="People"
        path="people"
        columns={columns}
        pageSize={20}
        filter={active.statuses ? { status: active.statuses } : undefined}
        actions={
          canEdit
            ? [
                { label: "Publish / activate", name: "publish" },
                { label: "Reset credentials", name: "reset-credentials" },
                { label: "Terminate", name: "terminate" },
              ]
            : []
        }
        onRowNavigate={(row) => router.push(`/app/company/people/${row.id}`)}
      />

      <p className="muted my-expenses-hint">
        Invite as draft, share the activation link, then assign roles on the person record.{" "}
        {canSeeRoles && (
          <Link className="detail-link" href="/app/company/roles">
            Roles →
          </Link>
        )}{" "}
        {canSeeSettings && (
          <Link className="detail-link" href="/app/company/settings">
            Settings →
          </Link>
        )}
      </p>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="muted">Loading people…</p>}>
      <PeopleContent />
    </Suspense>
  );
}
