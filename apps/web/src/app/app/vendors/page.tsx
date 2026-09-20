"use client";

import { useRouter } from "next/navigation";
import { ResourcePage } from "@/components/ResourcePage";

export default function Page() {
  const router = useRouter();
  return (
    <ResourcePage
      title="Vendors"
      path="vendors"
      onRowNavigate={(row) => router.push(`/app/vendors/${row.id}`)}
    />
  );
}
