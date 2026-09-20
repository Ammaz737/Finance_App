"use client";

import { useRouter } from "next/navigation";
import { ResourcePage } from "@/components/ResourcePage";

export default function Page() {
  const router = useRouter();
  return (
    <ResourcePage
      title="Trip requests"
      path="travel"
      filter={{ status: ["PENDING_APPROVAL", "APPROVED", "BOOKING", "CONFIRMED"] }}
      actions={[{ label: "Approve", name: "approve" }]}
      onRowNavigate={(row) => router.push(`/app/travel/trips/${row.id}`)}
    />
  );
}
