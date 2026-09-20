"use client";

import { useRouter } from "next/navigation";
import { ResourcePage } from "@/components/ResourcePage";

export default function Page() {
  const router = useRouter();
  return (
    <ResourcePage
      title="My travel"
      path="travel"
      mineField="travelerId"
      actions={[{ label: "Submit", name: "submit" }]}
      onRowNavigate={(row) => router.push(`/app/travel/trips/${row.id}`)}
    />
  );
}
