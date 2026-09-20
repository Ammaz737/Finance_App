"use client";

import { useRouter } from "next/navigation";
import { ResourcePage } from "@/components/ResourcePage";

export default function Page() {
  const router = useRouter();
  return <ResourcePage
    title="Funds"
    path="funds"
    onRowNavigate={(row) => router.push(`/app/spend/funds/${row.id}`)}
  />;
}
