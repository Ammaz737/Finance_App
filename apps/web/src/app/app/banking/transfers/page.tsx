import { ResourcePage } from "@/components/ResourcePage";

export default function Page() {
  return (
    <ResourcePage
      title="Transfers"
      path="treasury"
      actions={[
        { label: "Approve", name: "approve" },
        { label: "Release", name: "release" },
      ]}
    />
  );
}
