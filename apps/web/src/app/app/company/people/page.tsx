import { ResourcePage } from "@/components/ResourcePage";

export default function Page() {
  return (
    <ResourcePage
      title="People"
      path="people"
      actions={[
        { label: "Publish", name: "publish" },
        { label: "Reset credentials", name: "reset-credentials" },
        { label: "Terminate", name: "terminate" },
      ]}
    />
  );
}
