"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { NavigationIcon } from "@/components/NavigationIcon";
import { WorkSummary } from "@/components/PersonalWorkPresentation";

type SpendRow = { id: string; status?: string; [key: string]: unknown };
type SpendKind = "programs" | "requests" | "funds" | "transactions";

export function SpendOverview({ kind, rows, loading }: { kind: SpendKind; rows: SpendRow[]; loading: boolean }) {
  const count = (...statuses: string[]) => rows.filter(row => statuses.includes(row.status ?? "")).length;
  const stats = {
    programs: [
      { label: "Total programs", value: rows.length, note: "Company spending programs", icon: "receipt" as const },
      { label: "Active", value: count("ACTIVE"), note: "Available for new requests", icon: "check" as const },
      { label: "Inactive", value: count("INACTIVE"), note: "No longer accepting requests", icon: "clock" as const },
      { label: "Merchant locked", value: rows.filter(row => Boolean(row.merchantLockDefault)).length, note: "Restricted to named merchants", icon: "card" as const },
    ],
    requests: [
      { label: "Awaiting approval", value: count("SUBMITTED", "IN_REVIEW"), note: "Ready for a decision", icon: "clock" as const },
      { label: "Approved", value: count("APPROVED"), note: "Approved spending requests", icon: "check" as const },
      { label: "Fulfilled", value: count("FULFILLED"), note: "Funds or cards made available", icon: "card" as const },
      { label: "Needs follow-up", value: count("NEEDS_INFO", "BLOCKED", "REJECTED"), note: "Review outstanding issues", icon: "alert" as const },
    ],
    funds: [
      { label: "Active funds", value: count("ACTIVE"), note: "Current spending authority", icon: "card" as const },
      { label: "Low balance", value: rows.filter(row => row.status === "ACTIVE" && Number(row.limitAmount) > 0 && Number(row.availableAmount) / Number(row.limitAmount) <= .15).length, note: "15% or less remaining", icon: "alert" as const },
      { label: "Expired", value: count("EXPIRED"), note: "Validity period has ended", icon: "clock" as const },
      { label: "Closed / inactive", value: count("CLOSED", "INACTIVE"), note: "Not available for spending", icon: "receipt" as const },
    ],
    transactions: [
      { label: "Pending", value: count("PENDING"), note: "Open card authorizations", icon: "clock" as const },
      { label: "Cleared", value: count("CLEARED"), note: "Captured card payments", icon: "check" as const },
      { label: "Voided", value: count("VOIDED"), note: "Released authorization holds", icon: "receipt" as const },
      { label: "Reversed", value: count("REVERSED"), note: "Reversed card payments", icon: "card" as const },
    ],
  };
  return <WorkSummary stats={stats[kind]} loading={loading}/>;
}

export function SpendIntro({ title, description, children }: { title: string; description: string; children?: ReactNode }) {
  return <div className="expense-list-heading"><div><h2>{title}</h2><p>{description}</p></div>{children && <div className="spend-shortcuts">{children}</div>}</div>;
}

export function SpendRecord({ title, subtitle, href, icon }: { title: string; subtitle: string; href: string; icon: string }) {
  return <div className="expense-merchant"><span className="expense-merchant-icon" data-icon={icon}><NavigationIcon label={icon}/></span><span><Link href={href} onClick={event => event.stopPropagation()}>{title}</Link><small>{subtitle}</small></span></div>;
}

export function SpendOpenLink({ href, label = "Open record" }: { href: string; label?: string }) {
  return <Link className="expense-open" href={href} aria-label={label} onClick={event => event.stopPropagation()}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></Link>;
}
