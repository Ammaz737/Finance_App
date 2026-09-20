"use client";

import { useRouter } from "next/navigation";
import { ResourcePage } from "@/components/ResourcePage";

export default function Page() {
  const router = useRouter();
  return <ResourcePage
    title="My expenses"
    path="expenses"
    mineField="userId"
    actions={[{ label: "Submit", name: "submit" }]}
    onRowNavigate={(row) => router.push(`/app/expenses/${row.id}`)}
  />;
}
