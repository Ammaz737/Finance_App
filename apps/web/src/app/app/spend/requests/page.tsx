"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { ResourcePage } from "@/components/ResourcePage";

export default function Page() {
  const router = useRouter();
  return (
    <div className="stack gap-md">
      <p className="muted">
        Open a request for policy, approval progress, and fulfillment details.
        {" "}
        <Link href="/app/inbox">Go to Inbox</Link>
      </p>
      <ResourcePage
        title="Spend requests"
        path="spend-requests"
        actions={[{ label: "Approve", name: "approve" }]}
        onRowNavigate={(row) => router.push(`/app/spend/requests/${row.id}`)}
      />
    </div>
  );
}
