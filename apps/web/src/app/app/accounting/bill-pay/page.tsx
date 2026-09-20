import { ResourcePage } from "@/components/ResourcePage";

export default function Page() {
  return <ResourcePage title="Bill Pay accounting" path="accounting" filter={{ sourceType: ["BILL", "PAYMENT"] }} actions={[{ label: "Mark ready", name: "ready" }, { label: "Sync", name: "sync" }]} />;
}
