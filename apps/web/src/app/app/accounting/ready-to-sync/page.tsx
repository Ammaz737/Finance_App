import { ResourcePage } from "@/components/ResourcePage";

export default function Page() {
  return <ResourcePage title="Ready to sync" path="accounting" filter={{ status: ["READY_TO_SYNC"] }} actions={[{ label: "Undo ready", name: "undo-ready" }, { label: "Sync", name: "sync" }]} />;
}
