"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { PageHeader } from "@finance/design-system";
import { RoleBuilderForm, type RoleBuilderValues } from "@/features/roles";
import { api } from "@/lib/api";
import { useSession } from "@/providers/session-provider";

export default function CreateRolePage() {
  const router = useRouter();
  const session = useSession();
  const [error, setError] = useState("");

  const canManage =
    Boolean(session?.roles.includes("Owner")) ||
    Boolean(session?.permissions.includes("*")) ||
    Boolean(session?.permissions.includes("roles.assign"));

  const create = useMutation({
    mutationFn: (values: RoleBuilderValues) =>
      api.post<{ id: string }>("/rbac", {
        name: values.name,
        description: values.description,
        scope: values.scope,
        selection: values.selection,
      }),
    onSuccess: (role) => {
      router.push(`/app/company/roles/${role.id}`);
    },
    onError: (err: Error) => {
      setError(err.message || "Could not create role.");
    },
  });

  if (session && !canManage) {
    return (
      <div className="error-panel" role="alert">
        You need <code>roles.assign</code> to create roles.{" "}
        <Link className="detail-link" href="/app/company/roles">
          Back to roles
        </Link>
      </div>
    );
  }

  return (
    <div className="stack-lg company-builder-page linked-dest-page">
      <div className="resource-heading">
        <PageHeader title="Create role" subtitle="Name the role, then grant only the page permissions that apply" />
        <Link className="btn btn-ghost" href="/app/company/roles">
          Back to roles
        </Link>
      </div>

      <RoleBuilderForm
        mode="create"
        initial={{ name: "", description: "", scope: "ORGANIZATION", selection: {} }}
        submitting={create.isPending}
        error={error}
        onCancel={() => router.push("/app/company/roles")}
        onSubmit={(values) => {
          setError("");
          create.mutate(values);
        }}
      />
    </div>
  );
}
