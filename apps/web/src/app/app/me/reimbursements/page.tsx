"use client";

import { useRouter } from "next/navigation";
import { ResourcePage } from "@/components/ResourcePage";

export default function Page() {
  const router = useRouter();
  return <ResourcePage
    title="My reimbursements"
    path="reimbursements"
    mineField="userId"
    actions={[{ label: "Submit", name: "submit" }]}
    onRowNavigate={(row) => router.push(`/app/expenses/reimbursements/${row.id}`)}
  />;
}
