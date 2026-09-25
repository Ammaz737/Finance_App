import { ResourcePage } from "@/components/ResourcePage";

export default function Page() {
  return <ResourcePage title="Departments" path="departments" actions={[{ label: "Edit", name: "update" }, { label: "Archive", name: "archive" }]} />;
}
