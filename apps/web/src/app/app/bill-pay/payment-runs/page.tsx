"use client";

import { useRouter } from "next/navigation";
import { ResourcePage } from "@/components/ResourcePage";

export default function Page() {
  const router = useRouter();
  return (
    <ResourcePage
      title="Payment runs"
      path="payment-runs"
      actions={[{ label: "Release", name: "release" }]}
      onRowNavigate={(row) => router.push(`/app/bill-pay/payment-runs/${row.id}`)}
    />
  );
}
