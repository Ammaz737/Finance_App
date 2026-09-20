import { ResourcePage } from "@/components/ResourcePage";

export default function Page() {
  return <ResourcePage title="Spend requests" path="spend-requests" actions={[{ label: "Approve", name: "approve" }]} />;
}
