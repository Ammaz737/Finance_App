"use client";

import { useRouter } from "next/navigation";
import { ResourcePage } from "@/components/ResourcePage";

const sandboxActions = process.env.NODE_ENV === "production"
  ? [{ label: "Approve", name: "approve" }, { label: "Schedule payout", name: "schedule" }]
  : [
    { label: "Approve", name: "approve" },
    { label: "Schedule payout", name: "schedule" },
    { label: "Confirm payout", name: "confirm-payout" },
  ];

export default function Page() {
  const router = useRouter();
  return <ResourcePage
    title="Reimbursements"
    path="reimbursements"
    actions={sandboxActions}
    onRowNavigate={(row) => router.push(`/app/expenses/reimbursements/${row.id}`)}
  />;
}
