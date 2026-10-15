import type { ReactNode } from "react";
import "@/components/personal-work.css";
import "@/components/spend-ui.css";
import "@/components/company-ui.css";

export default function CompanyLayout({ children }: { children: ReactNode }) {
  return <div className="company-ui-scope">{children}</div>;
}
