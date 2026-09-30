"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { canSeeItem, findNavItem } from "@/config/navigation";
import { useSession } from "@/providers/session-provider";

const tabs = [
  { href: "/app/accounting/overview", label: "Overview" },
  { href: "/app/accounting/review", label: "Needs review" },
  { href: "/app/accounting/ready-to-sync", label: "Ready to sync" },
  { href: "/app/accounting/synced", label: "Synced" },
  { href: "/app/accounting/errors", label: "Sync errors" },
  { href: "/app/accounting/card", label: "Cards" },
  { href: "/app/accounting/reimbursements", label: "Reimbursements" },
  { href: "/app/accounting/bill-pay", label: "Bill Pay" },
  { href: "/app/accounting/rules", label: "Rules" },
  { href: "/app/accounting/integrations", label: "Integrations" },
];

export default function AccountingLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const session = useSession();
  const visibleTabs = tabs.filter((tab) => {
    const nav = findNavItem(tab.href) ?? { href: tab.href, permission: "accounting.read" };
    return session ? canSeeItem(nav, session) : false;
  });

  return (
    <div className="accounting-section">
      <nav className="subnav" aria-label="Accounting sections">
        {visibleTabs.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <Link key={tab.href} href={tab.href} className={active ? "active" : undefined} aria-current={active ? "page" : undefined}>
              {tab.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
