import { ResourcePage } from "@/components/ResourcePage";

export default function Page() {
  return <ResourcePage title="Synced" path="accounting" filter={{ status: ["SYNCED"] }} />;
}
