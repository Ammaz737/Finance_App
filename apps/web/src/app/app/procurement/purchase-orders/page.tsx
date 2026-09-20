"use client";

import { useRouter } from "next/navigation";
import { ResourcePage } from "@/components/ResourcePage";

export default function Page() {
  const router = useRouter();
  return (
    <ResourcePage
      title="Purchase orders"
      path="purchase-orders"
      actions={[{ label: "Receive", name: "receive" }]}
      onRowNavigate={(row) => router.push(`/app/procurement/purchase-orders/${row.id}`)}
    />
  );
}
