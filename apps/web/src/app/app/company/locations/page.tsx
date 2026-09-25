import { ResourcePage } from "@/components/ResourcePage";

export default function Page() {
  return <ResourcePage title="Locations" path="locations" actions={[{ label: "Edit", name: "update" }, { label: "Archive", name: "archive" }]} />;
}
