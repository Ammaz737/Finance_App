"use client";

import { useRouter } from "next/navigation";
import { ResourcePage } from "@/components/ResourcePage";

export default function Page() {
  const router = useRouter();
  return <ResourcePage
    title="My cards"
    path="cards"
    mineField="holderId"
    actions={[{ label: "Freeze", name: "freeze" }]}
    onRowNavigate={(row) => router.push(`/app/spend/cards/${row.id}`)}
  />;
}
