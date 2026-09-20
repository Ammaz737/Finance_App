"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ResourcePage } from "@/components/ResourcePage";

export default function Page() {
  const router = useRouter();
  return (
    <div>
      <p className="muted" style={{ marginBottom: "1rem" }}>
        Remaining = amount − actual − committed. Actual and committed never count the same dollars twice.{" "}
        <Link href="/app/insights/dashboard">Open dashboard</Link>
      </p>
      <ResourcePage
        title="Budgets"
        path="budgets"
        onRowNavigate={(row) => router.push(`/app/insights/budgets/${row.id}`)}
      />
    </div>
  );
}
