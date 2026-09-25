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
  amount: string; currency: string; outOfPolicy: boolean; policyResult?: string;
  refundable?: boolean; offerExpiry?: string; providerOfferId?: string;
  cancellationTerms?: string; provider?: string;
  itinerary?: Record<string, unknown>; startsAt?: string; endsAt?: string;
};

type Booking = {
  id: string; type: string; supplier: string; description: string;
  amount: string | number; currency: string; status: string;
  outOfPolicy: boolean; providerStatus: string; providerRef: string | null;
  confirmationNumber?: string; refundable?: boolean;
  cancellationTerms?: string; refundedAt?: string | null; cancelledAt?: string | null;
};

type Detail = {
  trip: {
    id: string; name: string; destination: string; origin?: string; purpose: string;
    startDate: string | null; endDate: string | null;
    estimatedAmount: string | number | null; currency: string;
    status: string; policyResult: string; policyExplanation: string;
    travelerId: string; fundId: string | null; cardId: string | null; expenseId: string | null;
    international?: boolean;
  };
  bookings: Booking[];
  fund: { id: string; name: string; availableAmount?: string | number } | null;
  card: { id: string; last4: string; status: string; allowedMccs?: string | null; providerRef?: string | null } | null;
  expense: { id: string; merchant: string; memo?: string } | null;
  approval: { status: string; currentStep: number } | null;
  audit: Array<{ id: string; action: string; createdAt: string }>;
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
      policyResult: quote.policyResult,
      refundable: quote.refundable,
      offerExpiry: quote.offerExpiry,
      providerOfferId: quote.providerOfferId,
      cancellationTerms: quote.cancellationTerms,
      provider: quote.provider,
      itinerary: quote.itinerary,
      startsAt: quote.startsAt,
      endsAt: quote.endsAt,
    }),
    onSuccess: () => {
      setMessage("Offer snapshot saved.");
      setQuotes([]);
      invalidate();
    },
  });

  const bookingAction = useMutation({
    mutationFn: ({ id, action, body }: { id: string; action: string; body?: Record<string, unknown> }) =>
      api.post(`/travel-bookings/${id}/${action}`, body ?? {}),
    onSuccess: (_data, variables) => {
      const labels: Record<string, string> = {
        "book-mock": "Mock hold placed — not a confirmed live booking.",
        confirm: "Sandbox confirmation recorded. Travel fund/card provisioned.",
        reprice: "Offer repriced within tolerance.",
        cancel: "Booking cancelled.",
        refund: "Refund recorded.",
      };
      setMessage(labels[variables.action] ?? `Booking ${variables.action} completed.`);
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

  const { trip, bookings, fund, card, expense, approval, audit } = detail.data;
  const privileged = session?.roles.includes("Owner") || session?.permissions.includes("*");
  const canBook = privileged || session?.permissions.includes("travel.book");
  const canApprove = trip.status === "PENDING_APPROVAL"
    && (privileged || session?.permissions.includes("travel.approve"))
    && session?.userId !== trip.travelerId;
  const canSubmit = trip.status === "DRAFT" && canBook;
  const bookable = ["READY_TO_BOOK", "APPROVED"].includes(trip.status);
  const canSearch = canBook && ["DRAFT", "APPROVED", "READY_TO_BOOK", "PENDING_APPROVAL"].includes(trip.status);
  const pending = tripAction.isPending || search.isPending || selectQuote.isPending || bookingAction.isPending || linkFund.isPending || linkExpense.isPending;
  const error = tripAction.error || search.error || selectQuote.error || bookingAction.error || linkFund.error || linkExpense.error;

  return <div className="spend-detail">
    <div className="resource-heading">
      <PageHeader title={trip.name} subtitle={`${trip.origin ? `${trip.origin} → ` : ""}${trip.destination} · ${money(trip.currency, trip.estimatedAmount)}`} />
      <Link className="btn btn-ghost" href="/app/travel/trips">Back</Link>
    </div>
    {message && <p className="notice" role="status">{message}</p>}
    {error && <p className="error" role="alert">{error.message}</p>}

    <div className="kpi-grid">
      <article className="kpi-card"><span>Status</span><strong><StatusBadge status={trip.status} /></strong><small>{approval ? `Approval ${approval.status}` : "No approval instance"}</small></article>
      <article className="kpi-card"><span>Policy</span><strong><StatusBadge status={trip.policyResult} /></strong><small>{trip.policyExplanation || "Evaluated on submit"}</small></article>
      <article className="kpi-card"><span>Dates</span><strong>{fmtDate(trip.startDate)} – {fmtDate(trip.endDate)}</strong><small>{trip.purpose || "No purpose"}{trip.international ? " · International" : ""}</small></article>
    </div>

    <div className="work-panels">
      <section className="work-panel">
        <h2>Itinerary & Bookings</h2>
        <ul className="plain-list">
          {bookings.map((booking) => (
            <li key={booking.id}>
              <strong>{booking.type}</strong> · {booking.supplier} · {money(booking.currency, booking.amount)}
              {" "}<StatusBadge status={booking.status} />
              {booking.outOfPolicy && <> · <StatusBadge status="OUT_OF_POLICY" /></>}
              <div className="muted">
                Provider: {booking.providerStatus}{booking.providerRef ? ` (${booking.providerRef})` : ""}
                {booking.confirmationNumber ? ` · Conf ${booking.confirmationNumber}` : ""}
              </div>
              <div className="muted">Cancellation terms: {booking.cancellationTerms || (booking.refundable ? "Refundable in sandbox" : "Non-refundable")}</div>
              {booking.cancelledAt && <div className="muted">Cancelled {fmtDate(booking.cancelledAt)} · Refund status {booking.refundedAt ? "REFUNDED" : booking.refundable ? "ELIGIBLE" : "NOT_ELIGIBLE"}{booking.refundedAt ? ` · ${money(booking.currency, booking.amount)}` : ""}</div>}
              <div className="detail-actions">
                {canBook && bookable && ["QUOTED", "PENDING_APPROVAL"].includes(booking.status) && (
                  <>
                    <button className="btn btn-ghost" type="button" disabled={pending} onClick={() => bookingAction.mutate({ id: booking.id, action: "reprice" })}>
                      Reprice
                    </button>
                    <button className="btn btn-primary" type="button" disabled={pending} onClick={() => bookingAction.mutate({ id: booking.id, action: "book-mock" })}>
                      Place mock hold
                    </button>
                  </>
                )}
                {canBook && booking.status === "REPRICE_REQUIRED" && (
                  <span className="muted">Price change exceeds tolerance — reselect or reapprove.</span>
                )}
                {canBook && booking.status === "BOOKED_MOCK" && (
                  <button className="btn btn-ghost" type="button" disabled={pending} onClick={() => bookingAction.mutate({ id: booking.id, action: "confirm" })}>
                    Confirm (sandbox)
                  </button>
                )}
                {canBook && ["CONFIRMED", "BOOKED_MOCK"].includes(booking.status) && (
                  <button className="btn btn-ghost" type="button" disabled={pending} onClick={() => bookingAction.mutate({ id: booking.id, action: "cancel" })}>
                    Cancel
                  </button>
                )}
                {canBook && ["REFUND_PENDING", "CANCELLED"].includes(booking.status) && (
                  <button className="btn btn-ghost" type="button" disabled={pending} onClick={() => bookingAction.mutate({ id: booking.id, action: "refund" })}>
                    Record refund
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
              <option value="FLIGHT">Flights</option>
              <option value="HOTEL">Hotels</option>
              <option value="CAR">Cars</option>
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
                {quote.policyResult ? ` · ${quote.policyResult}` : ""}
                <button className="btn btn-ghost" type="button" disabled={pending} onClick={() => selectQuote.mutate(quote)}>Select</button>
              </li>
            ))}
          </ul>
        )}

        <div className="detail-actions" style={{ marginTop: "1.25rem" }}>
          {canSubmit && <button className="btn btn-primary" type="button" disabled={pending} onClick={() => tripAction.mutate("submit")}>Submit</button>}
          {canApprove && <button className="btn btn-primary" type="button" disabled={pending} onClick={() => tripAction.mutate("approve")}>Approve</button>}
          {canBook && bookable && (
            <button className="btn btn-ghost" type="button" disabled={pending} onClick={() => tripAction.mutate("provision")}>Provision fund/card</button>
          )}
        </div>
      </section>

      <section className="work-panel">
        <h2>Fund / Card / Expense</h2>
        <dl className="detail-list">
          <div><dt>Fund</dt><dd>{fund?.name ?? trip.fundId ?? "—"}</dd></div>
          <div>
            <dt>Travel card</dt>
            <dd>
              {card
                ? <>····{card.last4} · {card.status}{card.providerRef?.startsWith("sandbox_") ? " · SANDBOX / MOCK CARD" : ""}</>
                : (trip.cardId ?? "—")}
            </dd>
          </div>
          <div><dt>Expense</dt><dd>{expense?.merchant ?? trip.expenseId ?? "—"}{expense?.memo ? ` · ${expense.memo}` : ""}</dd></div>
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

      <section className="work-panel">
        <h2>Activity</h2>
        <ul className="plain-list">
          {(audit ?? []).map((event) => (
            <li key={event.id}><code>{event.action}</code> · {fmtDate(event.createdAt)}</li>
          ))}
          {!(audit ?? []).length && <li className="muted">No audit events yet.</li>}
        </ul>
      </section>
    </div>
  </div>;
}
