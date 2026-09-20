import Link from "next/link";
import type { ReactNode } from "react";

const tabs = [
  { href: "/app/accounting/overview", label: "Overview" },
  { href: "/app/accounting/review", label: "Needs review" },
  { href: "/app/accounting/ready-to-sync", label: "Ready to sync" },
  { href: "/app/accounting/synced", label: "Synced" },
  { href: "/app/accounting/errors", label: "Errors" },
  { href: "/app/accounting/card", label: "Cards" },
  { href: "/app/accounting/reimbursements", label: "Reimbursements" },
  { href: "/app/accounting/bill-pay", label: "Bill Pay" },
  { href: "/app/accounting/rules", label: "Rules" },
];

export default function AccountingLayout({ children }: { children: ReactNode }) {
  return <div><nav className="subnav" aria-label="Accounting sections">{tabs.map((tab) => <Link key={tab.href} href={tab.href}>{tab.label}</Link>)}</nav>{children}</div>;
}
