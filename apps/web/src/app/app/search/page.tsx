"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input, PageHeader, StatusBadge } from "@finance/design-system";
import { api } from "@/lib/api";

type SearchHit = {
  id: string; type: string; title: string; subtitle: string; status?: string; href: string;
};

type SearchResult = {
  query: string;
  total: number;
  results: SearchHit[];
};

export default function Page() {
  const [q, setQ] = useState("");
  const [submitted, setSubmitted] = useState("");
  const search = useQuery({
    queryKey: ["search", submitted],
    queryFn: () => api.get<SearchResult>(`/search?q=${encodeURIComponent(submitted)}`),
    enabled: submitted.length > 0,
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(q.trim());
  }

  return (
    <div>
      <PageHeader title="Search" subtitle="Permission-scoped lookup across vendors, people, bills, expenses, POs, travel, and requests" />
      <form className="filter-bar" onSubmit={onSubmit} role="search">
        <label className="sr-only" htmlFor="global-search">Search workspace</label>
        <Input id="global-search" value={q} onChange={(event) => setQ(event.target.value)} placeholder="Vendor, person, invoice, trip…" />
        <button className="btn btn-primary" type="submit">Search</button>
      </form>
      {search.isError && <p className="error" role="alert">{search.error.message}</p>}
      {search.isPending && submitted && <p className="muted">Searching…</p>}
      {search.data && (
        <div aria-live="polite">
          <p className="muted">{search.data.total} results for “{search.data.query}”</p>
          <ul className="plain-list search-results">
            {search.data.results.map((hit) => (
              <li key={`${hit.type}-${hit.id}`}>
                <Link href={hit.href}>
                  <strong>{hit.title}</strong>
                  <span className="muted"> · {hit.type.replaceAll("_", " ")} · {hit.subtitle}</span>
                  {hit.status && <> · <StatusBadge status={hit.status} /></>}
                </Link>
              </li>
            ))}
            {!search.data.results.length && <li className="muted">No authorized matches.</li>}
          </ul>
        </div>
      )}
      {!submitted && <p className="muted">Enter at least one character. Results respect your roles and entity scope.</p>}
    </div>
  );
}
