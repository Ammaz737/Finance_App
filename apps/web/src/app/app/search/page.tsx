"use client";

import "./search.css";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { StatusBadge } from "@finance/design-system";
import { NavigationIcon } from "@/components/NavigationIcon";
import { api } from "@/lib/api";

type SearchHit = {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  status?: string;
  href: string;
};

type SearchResult = {
  query: string;
  total: number;
  results: SearchHit[];
};

const TYPE_META: Record<string, { label: string; hint: string }> = {
  vendor: { label: "Vendors", hint: "Supplier records" },
  person: { label: "People", hint: "Employees and admins" },
  bill: { label: "Bills", hint: "Invoices and AP" },
  payment: { label: "Payments", hint: "Payment records" },
  transaction: { label: "Transactions", hint: "Card activity" },
  expense: { label: "Expenses", hint: "Expense reports" },
  reimbursement: { label: "Reimbursements", hint: "Out-of-pocket claims" },
  purchase_order: { label: "Purchase orders", hint: "Procurement POs" },
  travel: { label: "Travel", hint: "Trips and bookings" },
  spend_request: { label: "Spend requests", hint: "Pre-approvals" },
  card: { label: "Cards", hint: "Virtual and physical cards" },
};

const SUGGESTIONS = [
  { label: "Vendors", example: "OpenAI" },
  { label: "People", example: "Elena" },
  { label: "Invoices", example: "PART-" },
  { label: "Expenses", example: "Merchant" },
  { label: "Travel", example: "NYC" },
];

const TYPE_ICONS: Record<string, string> = {
  vendor: "Vendors", person: "People", bill: "Bills", payment: "Payments",
  transaction: "Transactions", expense: "My expenses", reimbursement: "Reimbursements",
  purchase_order: "Purchase Orders", travel: "Travel", spend_request: "Spend requests", card: "Cards",
};

function typeLabel(type: string) {
  if (type === "person") return "Person";
  return TYPE_META[type]?.label.replace(/s$/, "") ?? type.replaceAll("_", " ");
}

export default function Page() {
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [submitted, setSubmitted] = useState(q.trim());
  const [typeFilter, setTypeFilter] = useState("ALL");
  const deferredQ = useDeferredValue(q.trim());

  useEffect(() => {
    const query = searchParams.get("q") ?? "";
    setQ(query);
    setSubmitted(query.trim());
    setTypeFilter("ALL");
  }, [searchParams]);

  // Live search after 2 chars; submit still works for exact refresh.
  useEffect(() => {
    if (deferredQ.length >= 2) {
      setSubmitted(deferredQ);
    }
    if (!deferredQ) {
      setSubmitted("");
    }
  }, [deferredQ]);

  const search = useQuery({
    queryKey: ["search", submitted],
    queryFn: () => api.get<SearchResult>(`/search?q=${encodeURIComponent(submitted)}`),
    enabled: submitted.length > 0,
  });

  const counts = useMemo(() => {
    const rows = search.data?.results ?? [];
    const byType: Record<string, number> = {};
    for (const row of rows) byType[row.type] = (byType[row.type] ?? 0) + 1;
    return byType;
  }, [search.data]);

  const filtered = useMemo(() => {
    const rows = search.data?.results ?? [];
    if (typeFilter === "ALL") return rows;
    return rows.filter((row) => row.type === typeFilter);
  }, [search.data, typeFilter]);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const next = q.trim();
    if (next && next === submitted) void search.refetch();
    setSubmitted(next);
    if (!next) setTypeFilter("ALL");
  }

  function clearSearch() {
    setQ("");
    setSubmitted("");
    setTypeFilter("ALL");
  }

  const categories = [
    { key: "ALL", label: "All records", icon: "Workspace" },
    ...Object.entries(TYPE_META).map(([key, meta]) => ({ key, label: meta.label, icon: TYPE_ICONS[key] })),
    ...Object.keys(counts).filter(key => !TYPE_META[key]).map(key => ({ key, label: typeLabel(key), icon: "Requests" })),
  ];
  const primaryTypes = ["ALL", "vendor", "person", "bill", "expense"];
  const moreTypes = categories.filter(item => !primaryTypes.includes(item.key));

  return (
    <div className="search-page">
      <nav className="search-breadcrumb" aria-label="Breadcrumb"><span>Workspace</span><span aria-hidden="true">/</span><span>Search</span></nav>
      <header className="search-page-heading"><div className="search-heading-mark"><NavigationIcon label="Search" /></div><div><h1>Workspace search</h1><p>One place to find your people, payments and records.</p></div></header>
      <div className="search-console">
        <form className="search-command-bar" role="search" onSubmit={onSubmit}>
          <NavigationIcon label="Search" />
          <label className="sr-only" htmlFor="global-search">Search workspace</label>
          <input id="global-search" value={q} onChange={event => setQ(event.target.value)} placeholder="Search by name, invoice number or keyword" autoComplete="off" autoFocus />
          {q && <button className="search-clear" type="button" onClick={clearSearch} aria-label="Clear search">×</button>}
          <button className="search-submit" type="submit" disabled={!q.trim()}>Search <span aria-hidden="true">↵</span></button>
        </form>
        <nav className="search-category-nav" aria-label="Filter search by record type">
          <div className="search-category-list">{categories.filter(item => primaryTypes.includes(item.key)).map(item => <button key={item.key} type="button" aria-pressed={typeFilter === item.key} className={`search-category${typeFilter === item.key ? " is-active" : ""}`} onClick={() => setTypeFilter(item.key)}>
            <NavigationIcon label={item.icon} /><span>{item.label}</span>{submitted && !search.isPending && !search.isError && <small>{item.key === "ALL" ? search.data?.total ?? 0 : counts[item.key] ?? 0}</small>}
          </button>)}<select className={`search-more-types${primaryTypes.includes(typeFilter) ? "" : " is-active"}`} aria-label="More record types" value={primaryTypes.includes(typeFilter) ? "" : typeFilter} onChange={event => { if (event.target.value) setTypeFilter(event.target.value); }}><option value="" disabled>More types</option>{moreTypes.map(item => <option key={item.key} value={item.key}>{item.label}{submitted && !search.isPending && !search.isError ? ` (${counts[item.key] ?? 0})` : ""}</option>)}</select></div>
        </nav>
        <section className="search-results-panel" aria-label="Search results" aria-live="polite" aria-busy={Boolean(submitted && search.isFetching)}>
          {!submitted ? <div className="search-start-state">
            <div className="search-start-art" aria-hidden="true"><span /><span /><div><NavigationIcon label="Search" /></div></div>
            <h2>What are you looking for?</h2>
            <p>Enter a name, reference or keyword to find matching records.</p>
            <div className="search-examples"><span>Suggested searches</span>{SUGGESTIONS.slice(0, 3).map(item => <button key={item.label} type="button" onClick={() => { setTypeFilter("ALL"); setQ(item.example); setSubmitted(item.example); }}><NavigationIcon label={item.label} /><span>{item.example}</span><span aria-hidden="true">↗</span></button>)}</div>
          </div> : <>
            <div className="search-results-head"><div><h2>{search.isError ? "Search unavailable" : search.isPending ? "Searching…" : `${filtered.length} result${filtered.length === 1 ? "" : "s"}`}</h2><p>{search.isError ? "Please try again." : `For “${submitted}”${typeFilter === "ALL" ? "" : ` in ${TYPE_META[typeFilter]?.label ?? typeLabel(typeFilter)}`}`}</p></div><span className="search-results-label">{typeFilter === "ALL" ? "All records" : TYPE_META[typeFilter]?.label ?? typeLabel(typeFilter)}</span></div>
            {search.isError ? <div className="search-state" role="alert"><NavigationIcon label="Needs review" /><h3>Unable to load results</h3><p>{search.error.message || "Please try your search again."}</p><button type="button" className="search-secondary" onClick={() => void search.refetch()}>Try again</button></div>
              : search.isPending ? <div className="search-state" role="status"><NavigationIcon label="Search" /><p>Looking for matching records…</p></div>
              : filtered.length === 0 ? <div className="search-state"><NavigationIcon label="Search" /><h3>No matching records</h3><p>Try a different name or reference{typeFilter !== "ALL" ? ", or search all record types." : "."}</p><button type="button" className="search-secondary" onClick={typeFilter === "ALL" ? clearSearch : () => setTypeFilter("ALL")}>{typeFilter === "ALL" ? "Clear search" : "Search all records"}</button></div>
              : <ul className="search-result-list">{filtered.map(hit => <li className="search-result" key={`${hit.type}-${hit.id}`}>
                <span className="search-result-icon" data-icon={TYPE_ICONS[hit.type] ?? "Requests"}><NavigationIcon label={TYPE_ICONS[hit.type] ?? "Requests"} /></span>
                <div className="search-result-main"><span className="search-result-type">{typeLabel(hit.type)}</span><Link href={hit.href} className="search-title-link">{hit.title}</Link><p>{hit.subtitle}</p></div>
                <div className="search-result-side">{hit.status && <StatusBadge status={hit.status} />}<Link className="search-open-link" href={hit.href} aria-label={`Open ${hit.title}`}><span>Open</span><span aria-hidden="true">↗</span></Link></div>
              </li>)}</ul>}
          </>}
        </section>
        <footer className="search-console-footer"><span><NavigationIcon label="Policies" />Only records you have access to are shown</span><span>Live results after 2 characters</span></footer>
      </div>
    </div>
  );
}
