import { ResourcePage } from "@/components/ResourcePage";

export default function Page() {
  return <ResourcePage title="Sync errors" path="accounting" filter={{ status: ["SYNC_ERROR"] }} actions={[{ label: "Retry", name: "retry" }, { label: "Mark ready", name: "ready" }]} />;
}
