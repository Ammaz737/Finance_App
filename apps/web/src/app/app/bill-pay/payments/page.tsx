"use client";

import { useRouter } from "next/navigation";
import { ResourcePage } from "@/components/ResourcePage";

export default function Page() {
  const router = useRouter();
  return <ResourcePage
    title="Payments"
    path="payments"
    actions={[{ label: "Release", name: "release" }, { label: "Confirm settlement", name: "confirm-settlement" }]}
    onRowNavigate={(row) => router.push(`/app/bill-pay/payments/${row.id}`)}
  />;
}
