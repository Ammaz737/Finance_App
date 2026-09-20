import { ResourcePage } from "@/components/ResourcePage";

export default function Page() {
  return <ResourcePage title="Needs review" path="accounting" filter={{ status: ["NEEDS_REVIEW"] }} actions={[{ label: "Mark ready", name: "ready" }]} />;
}
