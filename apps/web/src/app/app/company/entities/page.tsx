import { ResourcePage } from "@/components/ResourcePage";

export default function Page() {
  return <ResourcePage title="Legal entities" path="entities" actions={[{ label: "Edit", name: "update" }, { label: "Archive", name: "archive" }]} />;
}
