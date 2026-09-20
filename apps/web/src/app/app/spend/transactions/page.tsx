import { ResourcePage } from "@/components/ResourcePage";

const sandboxActions = process.env.NODE_ENV === "production" ? [] : [
  { label: "Capture", name: "capture" },
  { label: "Void", name: "void" },
  { label: "Reverse", name: "reverse" },
  { label: "Simulate clearing", name: "clear" },
];

export default function Page() {
  return <ResourcePage title="Transactions" path="transactions" actions={sandboxActions} />;
}
