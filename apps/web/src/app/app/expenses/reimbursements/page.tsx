"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ResourcePage } from "@/components/ResourcePage";

const sandboxActions = process.env.NODE_ENV === "production"
  ? [{ label: "Submit", name: "submit" }, { label: "Approve", name: "approve" }, { label: "Schedule payout", name: "schedule" }]
  : [
    { label: "Submit", name: "submit" },
    { label: "Approve", name: "approve" },
    { label: "Schedule payout", name: "schedule" },
    { label: "Confirm payout", name: "confirm-payout" },
  ];

export default function Page() {
  const router = useRouter();
  const search = useSearchParams();
  const status = search.get("status");
  const statusLabels: Record<string, string> = {
    IN_REVIEW: "For approval",
    APPROVED: "For payout",
    PAID: "Paid / History",
    FAILED: "Failures",
  };
  const selectedStatus = status && statusLabels[status] ? status : null;
  return <ResourcePage
    title={selectedStatus ? statusLabels[selectedStatus] : "Reimbursements"}
    path="reimbursements"
    filter={selectedStatus ? { status: [selectedStatus] } : undefined}
    actions={sandboxActions}
    onRowNavigate={(row) => router.push(`/app/expenses/reimbursements/${row.id}`)}
  />;
}
