"use client";

import { useRouter } from "next/navigation";
import { ResourcePage } from "@/components/ResourcePage";

export default function Page() {
  const router = useRouter();
  return <ResourcePage
    title="Receipts"
    path="receipts"
    onRowNavigate={(row) => {
      if (typeof row.expenseId === "string" && row.expenseId) router.push(`/app/expenses/${row.expenseId}`);
    }}
  />;
}
