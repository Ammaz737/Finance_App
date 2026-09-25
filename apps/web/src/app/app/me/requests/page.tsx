"use client";
import { useRouter } from "next/navigation";
import { ResourcePage } from "@/components/ResourcePage";

export default function Page() {
  const router = useRouter();
  return <ResourcePage title="My requests" path="spend-requests" mineField="requesterId" onRowNavigate={(row) => router.push(`/app/spend/requests/${row.id}`)} />;
}
