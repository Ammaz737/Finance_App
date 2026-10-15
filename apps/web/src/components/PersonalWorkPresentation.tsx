import type { ReactNode } from "react";

export function WorkIcon({ kind = "receipt" }: { kind?: "receipt" | "clock" | "check" | "alert" | "card" | "plane" }) {
  const paths: Record<string, ReactNode> = {
    plane: <><path d="m21 3-6 18-4-8-8-4 18-6Z"/><path d="m11 13 5-5"/></>,
    receipt: <><path d="M6 3h9l3 3v15l-3-2-3 2-3-2-3 2z"/><path d="M14 3v4h4M9 11h6M9 15h4"/></>,
    clock: <><circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/></>,
    check: <><rect x="4" y="4" width="16" height="16" rx="4"/><path d="m8 12 3 3 5-6"/></>,
    alert: <><circle cx="12" cy="12" r="8"/><path d="M12 7v6m0 3h.01"/></>,
    card: <><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18M7 15h3"/></>,
  };
  return <svg data-kind={kind} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[kind]}</svg>;
}


export function WorkSummary({ stats, loading }: { stats: Array<{ label: string; value: number; note: string; icon: "receipt" | "clock" | "check" | "alert" | "card" | "plane" }>; loading: boolean }) {
  return <div className="expense-overview" aria-label="List summary">
    {stats.map(stat => <article key={stat.label} data-tone={stat.icon}>
      <div className="expense-stat-top"><span>{stat.label}</span><span className="expense-stat-icon"><WorkIcon kind={stat.icon}/></span></div>
      <strong>{loading ? "—" : stat.value}</strong><small>{stat.note}</small>
    </article>)}
  </div>;
}
