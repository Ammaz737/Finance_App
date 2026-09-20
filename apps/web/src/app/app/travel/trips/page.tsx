"use client";

import { useRouter } from "next/navigation";
import { ResourcePage } from "@/components/ResourcePage";

export default function Page() {
  const router = useRouter();
  return (
    <ResourcePage
      title="Travel trips"
      path="travel"
      actions={[
        { label: "Submit", name: "submit" },
        { label: "Approve", name: "approve" },
      ]}
      onRowNavigate={(row) => router.push(`/app/travel/trips/${row.id}`)}
    />
  );
}
