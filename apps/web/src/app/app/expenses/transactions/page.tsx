"use client";

import { useRouter } from "next/navigation";
import { ResourcePage } from "@/components/ResourcePage";

export default function Page() {
  const router = useRouter();
  return <ResourcePage
    title="Expense review"
    path="expenses"
    actions={[
      { label: "Submit", name: "submit" },
      { label: "Approve", name: "approve" },
    ]}
    onRowNavigate={(row) => router.push(`/app/expenses/${row.id}`)}
  />;
}
