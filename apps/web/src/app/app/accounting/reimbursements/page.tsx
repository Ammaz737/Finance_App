import { ResourcePage } from "@/components/ResourcePage";

export default function Page() {
  return <ResourcePage title="Reimbursement accounting" path="accounting" filter={{ sourceType: ["REIMBURSEMENT"] }} actions={[{ label: "Mark ready", name: "ready" }, { label: "Sync", name: "sync" }]} />;
}
