import { ResourcePage } from "@/components/ResourcePage";

export default function Page() {
  return <ResourcePage title="Card accounting" path="accounting" filter={{ sourceType: ["CARD_TRANSACTION"] }} actions={[{ label: "Mark ready", name: "ready" }, { label: "Sync", name: "sync" }]} />;
}
