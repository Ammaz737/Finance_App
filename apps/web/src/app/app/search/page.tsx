"use client";

import Link from "next/link";
import { FormEvent, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { StatusBadge } from "@finance/design-system";
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

function typeLabel(type: string) {
  return TYPE_META[type]?.label.replace(/s$/, "") ?? type.replaceAll("_", " ");
}

export default function Page() {
  const [q, setQ] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const deferredQ = useDeferredValue(q.trim());

  // Live search after 2 chars; submit still works for exact refresh.
  useEffect(() => {
    if (deferredQ.length >= 2) setSubmitted(deferredQ);
    if (!deferredQ) {
      setSubmitted("");
      setTypeFilter("ALL");
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
    setSubmitted(next);
    if (!next) setTypeFilter("ALL");
  }

  function clearSearch() {
    setQ("");
    setSubmitted("");
    setTypeFilter("ALL");
  }

  const typeChips = [
    { key: "ALL", label: "All", count: search.data?.total ?? 0 },
    ...Object.keys(TYPE_META)
      .filter((key) => (counts[key] ?? 0) > 0)
      .map((key) => ({ key, label: TYPE_META[key].label, count: counts[key] ?? 0 })),
  ];

  return (
    <div className="search-page">
      <header className="search-hero">
        <p className="overview-kicker">Workspace</p>
        <h1>Search</h1>
        <p className="overview-lead">
          Find vendors, people, bills, expenses, cards, travel, and requests — only records your role and entity scope allow.
        </p>
        <form className="search-bar" onSubmit={onSubmit} role="search">
          <label className="sr-only" htmlFor="global-search">Search workspace</label>
          <input
            id="global-search"
            className="input search-input"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Search vendors, people, invoices, trips, cards…"
            autoComplete="off"
            autoFocus
          />
          {q && (
            <button type="button" className="btn btn-ghost search-clear" onClick={clearSearch}>
              Clear
            </button>
          )}
          <button className="btn btn-primary" type="submit" disabled={!q.trim()}>
            Search
          </button>
        </form>
        <p className="search-hint muted">
          Tip: type at least 2 characters for live results. Press Enter to refresh.
        </p>
      </header>

      {!submitted && (
        <section className="search-empty" aria-label="Search suggestions">
          <h2>Try searching for</h2>
          <div className="search-suggestions">
            {SUGGESTIONS.map((item) => (
              <button
                key={item.label}
                type="button"
                className="search-suggestion"
                onClick={() => {
                  setQ(item.example);
                  setSubmitted(item.example);
                }}
              >
                <strong>{item.label}</strong>
                <span>{item.example}</span>
              </button>
            ))}
          </div>
          <div className="search-scope-note">
            <strong>Permission-aware</strong>
            <p>Employees only see their own spend and expenses. Finance and owners see company-wide records they can access.</p>
          </div>
        </section>
      )}

      {submitted && (
        <section className="search-results-panel" aria-live="polite">
          <div className="search-results-head">
            <div>
              <h2>
                {search.isPending ? "Searching…" : `${filtered.length} result${filtered.length === 1 ? "" : "s"}`}
              </h2>
              <p className="muted">
                {search.isPending
                  ? `Looking up “${submitted}”`
                  : typeFilter === "ALL"
                    ? `${search.data?.total ?? 0} matches for “${submitted}”`
                    : `${filtered.length} of ${search.data?.total ?? 0} for “${submitted}” · ${TYPE_META[typeFilter]?.label ?? typeFilter}`}
              </p>
            </div>
          </div>

          {search.isError && (
            <p className="error-panel" role="alert">
              {search.error.message || "Search failed."}{" "}
              <button type="button" className="text-button" onClick={() => void search.refetch()}>Try again</button>
            </p>
          )}

          {!search.isPending && !search.isError && (search.data?.total ?? 0) > 0 && (
            <div className="filter-row search-type-row">
              {typeChips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  className={`chip ${typeFilter === chip.key ? "chip-active" : ""}`}
                  onClick={() => setTypeFilter(chip.key)}
                >
                  {chip.label}
                  <span className="chip-count">{chip.count}</span>
                </button>
              ))}
            </div>
          )}

          {!search.isPending && !search.isError && filtered.length === 0 && (
            <div className="empty-work">
              <strong>No authorized matches</strong>
              <p>
                Nothing matched “{submitted}” in the records you can access. Try another term, or clear filters.
              </p>
              <button type="button" className="btn btn-ghost" onClick={clearSearch}>Clear search</button>
            </div>
          )}

          {!search.isPending && filtered.length > 0 && (
            <div className="table-wrap search-table">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Name</th>
                    <th>Details</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((hit) => (
                    <tr key={`${hit.type}-${hit.id}`}>
                      <td>
                        <span className="search-type-pill">{typeLabel(hit.type)}</span>
                      </td>
                      <td>
                        <Link href={hit.href} className="search-title-link">
                          <strong>{hit.title}</strong>
                        </Link>
                      </td>
                      <td className="muted">{hit.subtitle}</td>
                      <td>{hit.status ? <StatusBadge status={hit.status} /> : "—"}</td>
                      <td>
                        <Link className="btn btn-ghost" href={hit.href}>Open</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
