import { ResourcePage } from "@/components/ResourcePage";

export default function Page() {
  return <ResourcePage title="Payments" path="payments" actions={[{ label: "Release", name: "release" }]} />;
}
