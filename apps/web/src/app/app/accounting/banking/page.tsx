import { ResourcePage } from "@/components/ResourcePage";

export default function Page() {
  return <ResourcePage title="Banking accounting" path="accounting" filter={{ sourceType: ["BANK", "BANK_TRANSFER"] }} />;
}
