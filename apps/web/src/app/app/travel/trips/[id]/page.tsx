"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader, StatusBadge } from "@finance/design-system";
import { api } from "@/lib/api";
import { useSession } from "@/providers/session-provider";

type Quote = {
  quoteId: string; type: string; supplier: string; description: string;
  amount: string; currency: string; outOfPolicy: boolean;
  itinerary?: Record<string, unknown>; startsAt?: string; endsAt?: string;
};

type Booking = {
  id: string; type: string; supplier: string; description: string;
  amount: string | number; currency: string; status: string;
  outOfPolicy: boolean; providerStatus: string; providerRef: string | null;
};

type Detail = {
  trip: {
    id: string; name: string; destination: string; purpose: string;
    startDate: string | null; endDate: string | null;
    estimatedAmount: string | number | null; currency: string;
    status: string; policyResult: string; policyExplanation: string;
    travelerId: string; fundId: string | null; expenseId: string | null;
  };
  bookings: Booking[];
  fund: { id: string; name: string } | null;
  expense: { id: string; merchant: string } | null;
  approval: { status: string; currentStep: number } | null;
};

function money(currency: string, value: string | number | null | undefined) {
  if (value == null) return "—";
  const amount = Number(value);
  return `${currency} ${Number.isFinite(amount) ? amount.toLocaleString(undefined, { minimumFractionDigits: 2 }) : String(value)}`;
}

function fmtDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

export default function TravelTripDetailPage() {
  const params = useParams<{ id: string }>();
  const session = useSession();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [searchType, setSearchType] = useState<"FLIGHT" | "HOTEL" | "CAR">("FLIGHT");
  const [fundId, setFundId] = useState("");
  const [expenseId, setExpenseId] = useState("");

  const detail = useQuery({
    queryKey: ["travel-detail", params.id],
    queryFn: () => api.get<Detail>(`/travel/${params.id}`),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["travel-detail", params.id] });
    void queryClient.invalidateQueries({ queryKey: ["resource", "travel"] });
  };

  const tripAction = useMutation({
    mutationFn: (action: string) => api.post(`/travel/${params.id}/${action}`, {}),
    onSuccess: (_data, action) => {
      setMessage(`Action ${action} completed.`);
      invalidate();
    },
  });

  const search = useMutation({
    mutationFn: () => api.post<{ quotes: Quote[] }>(`/travel/${params.id}/search`, { type: searchType }),
    onSuccess: (data) => {
      setQuotes(data.quotes ?? []);
      setMessage(`Found ${(data.quotes ?? []).length} ${searchType.toLowerCase()} options.`);
    },
  });

  const selectQuote = useMutation({
    mutationFn: (quote: Quote) => api.post(`/travel/${params.id}/select-quote`, {
      quoteId: quote.quoteId,
      type: quote.type,
      supplier: quote.supplier,
      description: quote.description,
      amount: quote.amount,
      currency: quote.currency,
      outOfPolicy: quote.outOfPolicy,
      itinerary: quote.itinerary,
      startsAt: quote.startsAt,
      endsAt: quote.endsAt,
    }),
    onSuccess: () => {
      setMessage("Quote added to itinerary.");
      setQuotes([]);
      invalidate();
    },
  });

  const bookingAction = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) => api.post(`/travel-bookings/${id}/${action}`, {}),
    onSuccess: (_data, variables) => {
      setMessage(variables.action === "book-mock"
        ? "Mock hold placed — not a confirmed live booking."
        : "Sandbox confirmation recorded.");
      invalidate();
    },
  });

  const linkFund = useMutation({
    mutationFn: () => api.post(`/travel/${params.id}/link-fund`, { fundId }),
    onSuccess: () => { setMessage("Fund linked."); setFundId(""); invalidate(); },
  });

  const linkExpense = useMutation({
    mutationFn: () => api.post(`/travel/${params.id}/link-expense`, { expenseId }),
    onSuccess: () => { setMessage("Expense linked."); setExpenseId(""); invalidate(); },
  });

  if (detail.isError) {
    return <div className="error-panel">Could not load trip. <button className="text-button" onClick={() => void detail.refetch()}>Try again</button></div>;
  }
  if (detail.isPending || !detail.data) return <p className="muted">Loading trip…</p>;

  const { trip, bookings, fund, expense, approval } = detail.data;
  const privileged = session?.roles.includes("Owner") || session?.permissions.includes("*");
  const canBook = privileged || session?.permissions.includes("travel.book");
  const canApprove = trip.status === "PENDING_APPROVAL"
    && (privileged || session?.permissions.includes("travel.approve"))
    && session?.userId !== trip.travelerId;
  const canSubmit = trip.status === "DRAFT" && canBook;
  const canSearch = canBook && ["DRAFT", "APPROVED", "PENDING_APPROVAL"].includes(trip.status);
  const pending = tripAction.isPending || search.isPending || selectQuote.isPending || bookingAction.isPending || linkFund.isPending || linkExpense.isPending;
  const error = tripAction.error || search.error || selectQuote.error || bookingAction.error || linkFund.error || linkExpense.error;

  return <div className="spend-detail">
    <div className="resource-heading">
      <PageHeader title={trip.name} subtitle={`${trip.destination} · ${money(trip.currency, trip.estimatedAmount)}`} />
      <Link className="btn btn-ghost" href="/app/travel/trips">Back</Link>
    </div>
    {message && <p className="notice" role="status">{message}</p>}
    {error && <p className="error" role="alert">{error.message}</p>}

    <div className="kpi-grid">
      <article className="kpi-card"><span>Status</span><strong><StatusBadge status={trip.status} /></strong><small>{approval ? `Approval ${approval.status}` : "No approval instance"}</small></article>
      <article className="kpi-card"><span>Policy</span><strong><StatusBadge status={trip.policyResult} /></strong><small>{trip.policyExplanation || "Evaluated on submit"}</small></article>
      <article className="kpi-card"><span>Dates</span><strong>{fmtDate(trip.startDate)} – {fmtDate(trip.endDate)}</strong><small>{trip.purpose || "No purpose"}</small></article>
    </div>

    <div className="work-panels">
      <section className="work-panel">
        <h2>Itinerary</h2>
        <ul className="plain-list">
          {bookings.map((booking) => (
            <li key={booking.id}>
              <strong>{booking.type}</strong> · {booking.supplier} · {money(booking.currency, booking.amount)}
              {" "}<StatusBadge status={booking.status} />
              {booking.outOfPolicy && <> · <StatusBadge status="OUT_OF_POLICY" /></>}
              <div className="muted">Provider: {booking.providerStatus}{booking.providerRef ? ` (${booking.providerRef})` : ""}</div>
              <div className="detail-actions">
                {canBook && trip.status === "APPROVED" && ["QUOTED", "PENDING_APPROVAL"].includes(booking.status) && (
                  <button className="btn btn-primary" type="button" disabled={pending} onClick={() => bookingAction.mutate({ id: booking.id, action: "book-mock" })}>
                    Place mock hold
                  </button>
                )}
                {canBook && booking.status === "BOOKED_MOCK" && (
                  <button className="btn btn-ghost" type="button" disabled={pending} onClick={() => bookingAction.mutate({ id: booking.id, action: "confirm" })}>
                    Confirm (sandbox)
                  </button>
                )}
              </div>
            </li>
          ))}
          {!bookings.length && <li className="muted">No quotes selected yet. Search below.</li>}
        </ul>

        {canSearch && (
          <div className="detail-actions" style={{ marginTop: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
            <select className="input" value={searchType} onChange={(event) => setSearchType(event.target.value as "FLIGHT" | "HOTEL" | "CAR")} aria-label="Search type">
              <option value="FLIGHT">Flight</option>
              <option value="HOTEL">Hotel</option>
              <option value="CAR">Car</option>
            </select>
            <button className="btn btn-primary" type="button" disabled={pending} onClick={() => search.mutate()}>Search quotes</button>
          </div>
        )}

        {quotes.length > 0 && (
          <ul className="plain-list" style={{ marginTop: "1rem" }}>
            {quotes.map((quote) => (
              <li key={quote.quoteId}>
                {quote.supplier} · {quote.description} · {money(quote.currency, quote.amount)}
                {quote.outOfPolicy ? " · Out of policy" : " · In policy"}
                <button className="btn btn-ghost" type="button" disabled={pending} onClick={() => selectQuote.mutate(quote)}>Select</button>
              </li>
            ))}
          </ul>
        )}

        <div className="detail-actions" style={{ marginTop: "1.25rem" }}>
          {canSubmit && <button className="btn btn-primary" type="button" disabled={pending} onClick={() => tripAction.mutate("submit")}>Submit</button>}
          {canApprove && <button className="btn btn-primary" type="button" disabled={pending} onClick={() => tripAction.mutate("approve")}>Approve</button>}
        </div>
      </section>

      <section className="work-panel">
        <h2>Links</h2>
        <dl className="detail-list">
          <div><dt>Fund</dt><dd>{fund?.name ?? trip.fundId ?? "—"}</dd></div>
          <div><dt>Expense</dt><dd>{expense?.merchant ?? trip.expenseId ?? "—"}</dd></div>
        </dl>
        {canBook && (
          <div className="record-form">
            <label>Fund ID<input className="input" value={fundId} onChange={(event) => setFundId(event.target.value)} placeholder="Link spend fund" /></label>
            <button className="btn btn-ghost" type="button" disabled={pending || !fundId.trim()} onClick={() => linkFund.mutate()}>Link fund</button>
            <label>Expense ID<input className="input" value={expenseId} onChange={(event) => setExpenseId(event.target.value)} placeholder="Link expense" /></label>
            <button className="btn btn-ghost" type="button" disabled={pending || !expenseId.trim()} onClick={() => linkExpense.mutate()}>Link expense</button>
          </div>
        )}
      </section>
    </div>
  </div>;
}
