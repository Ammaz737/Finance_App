"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { canSeeItem, findNavItem } from "@/config/navigation";
import { api } from "@/lib/api";
import { useSession } from "@/providers/session-provider";

type MoneyTotal = { currency: string; amount: string };
type MyOverview = { cards: number; openExpenses: number; pendingRequests: number; availableFunds: MoneyTotal[] };
type FinanceOverview = {
  companyCashByCurrency?: MoneyTotal[];
  companyCashSource?: "stripe" | "bank_accounts" | "unavailable";
  companyCashAccountId?: string | null;
  companyCashStatus?: string | null;
  companyCashError?: string | null;
  clearedSpendByCurrency: MoneyTotal[];
  openPayablesByCurrency: MoneyTotal[];
  budgetCapacityByCurrency?: MoneyTotal[];
  budgetUsedByCurrency?: MoneyTotal[];
  openPoCommitmentsByCurrency?: MoneyTotal[];
  activePeople: number;
  pendingBills: number;
  accountingReview: number;
  pendingRequests: number;
  travelPending?: number;
  unreadNotifications?: number;
  integrations?: { total: number; healthy: number; degraded: number };
  freshness?: { asOf: string; budgetFreshness: string };
  asOf: string;
};
type Notification = { id: string; readAt: string | null };
type InboxTask = { id: string; title?: string; type?: string; amount?: string; currency?: string };

function hasPerm(session: { roles: string[]; permissions: string[] } | null | undefined, permission: string) {
  if (!session) return false;
  return session.roles.includes("Owner") || session.permissions.includes("*") || session.permissions.includes(permission);
}

function moneyList(totals: MoneyTotal[] | undefined) {
  if (!totals?.length) return "—";
  return totals.map((item) => `${item.currency} ${Number(item.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`).join(" · ");
}

function moneyPrimary(totals: MoneyTotal[] | undefined) {
  if (!totals?.length) return { value: "—", hint: "No balances yet" };
  const first = totals[0]!;
  const rest = totals.slice(1);
  return {
    value: `${first.currency} ${Number(first.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    hint: rest.length ? `Also ${moneyList(rest)}` : undefined,
  };
}

function greetingForHour(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function navVisible(
  session: { roles: string[]; permissions: string[]; entitlements: string[] } | null | undefined,
  href: string,
  fallbackPermission?: string,
) {
  if (!session) return false;
  const item = findNavItem(href) ?? (fallbackPermission ? { href, permission: fallbackPermission } : { href });
  return canSeeItem(item, session);
}

export function OverviewDashboard({ executive = false }: { executive?: boolean }) {
  const session = useSession();
  const canReport = hasPerm(session, "report.read");
  const canCreateSpend = hasPerm(session, "spend_request.create");
  const canCreateExpense = hasPerm(session, "expense.create");
  const canCreateReimbursement = hasPerm(session, "reimbursement.create");
  const canBookTravel = hasPerm(session, "travel.book");
  const canCreateBill = hasPerm(session, "bill.create");
  const canApproveSpend = hasPerm(session, "spend_request.approve");

  const canSeeBudgets = navVisible(session, "/app/insights/budgets", "report.read");
  const canSeeTxns = navVisible(session, "/app/spend/transactions", "expense.read");
  const canSeeBills = navVisible(session, "/app/bill-pay/bills", "bill.create");
  const canSeeBillApproval = navVisible(session, "/app/bill-pay/bills?stage=approval", "bill.approve");
  const canSeePos = navVisible(session, "/app/procurement/purchase-orders", "procurement.review");
  const canSeeIntegrations = navVisible(session, "/app/company/integrations", "report.read");
  const canSeeAudit = navVisible(session, "/app/company/audit", "audit.read");
  const canSeeSpendQueue = navVisible(session, "/app/spend/requests", "spend_request.approve");
  const canSeeTravelQueue = navVisible(session, "/app/travel/requests", "travel.approve");
  const canSeeAccounting = navVisible(session, "/app/accounting/overview", "accounting.read");
  const canSeeAccountingReview = navVisible(session, "/app/accounting/review", "accounting.read");

  const mine = useQuery({ queryKey: ["my-overview"], queryFn: () => api.get<MyOverview>("/identity/overview") });
  const finance = useQuery({ queryKey: ["finance-overview"], queryFn: () => api.get<FinanceOverview>("/reporting"), enabled: canReport });
  const notifications = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.get<Notification[]>("/notifications"),
  });
  const inbox = useQuery({
    queryKey: ["inbox"],
    queryFn: () => api.get<InboxTask[]>("/inbox"),
  });

  const name = session?.user.firstName ?? "there";
  const unread = (notifications.data ?? []).filter((item) => !item.readAt).length;
  const inboxCount = inbox.data?.length ?? 0;
  const funds = moneyPrimary(mine.data?.availableFunds);
  const todayLabel = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  const attention: Array<{ href: string; label: string; detail: string; count: number | string; tone?: "urgent" | "default" }> = [];
  if (inboxCount > 0) {
    attention.push({ href: "/app/inbox", label: "Inbox approvals", detail: "Waiting on your decision", count: inboxCount, tone: "urgent" });
  }
  if ((mine.data?.openExpenses ?? 0) > 0) {
    attention.push({ href: "/app/me/expenses", label: "Expenses to complete", detail: "Add receipts or missing details", count: mine.data!.openExpenses, tone: "urgent" });
  }
  if ((mine.data?.pendingRequests ?? 0) > 0 && canCreateSpend) {
    attention.push({ href: "/app/me/requests", label: "Your pending requests", detail: "Awaiting a decision", count: mine.data!.pendingRequests });
  }
  if (unread > 0) {
    attention.push({ href: "/app/notifications", label: "Unread notifications", detail: "Mentions and status updates", count: unread });
  }
  if (canReport && (finance.data?.pendingBills ?? 0) > 0 && canSeeBillApproval) {
    attention.push({ href: "/app/bill-pay/bills?stage=approval", label: "Bills for approval", detail: "Accounts payable queue", count: finance.data!.pendingBills });
  }
  if (canReport && (finance.data?.accountingReview ?? 0) > 0 && canSeeAccountingReview) {
    attention.push({ href: "/app/accounting/review", label: "Accounting review", detail: "Entries needing coding", count: finance.data!.accountingReview });
  }
  if (canReport && canSeeTravelQueue && (finance.data?.travelPending ?? 0) > 0) {
    attention.push({ href: "/app/travel/requests", label: "Travel pending", detail: "Trips awaiting review", count: finance.data!.travelPending! });
  }
  if (canReport && canSeeSpendQueue && (finance.data?.pendingRequests ?? 0) > 0 && inboxCount === 0) {
    attention.push({ href: "/app/spend/requests", label: "Spend requests", detail: "Company queue", count: finance.data!.pendingRequests });
  }

  const personalActions = [
    canCreateSpend ? { href: "/app/me/requests", label: "Request spend" } : null,
    canCreateExpense ? { href: "/app/me/expenses", label: "Complete expenses" } : null,
    canCreateReimbursement ? { href: "/app/me/reimbursements", label: "New reimbursement" } : null,
    canBookTravel ? { href: "/app/me/travel", label: "Book travel" } : null,
    canCreateBill ? { href: "/app/bill-pay/bills/new", label: "Create bill" } : null,
    { href: "/app/inbox", label: "Open inbox" },
  ].filter(Boolean) as Array<{ href: string; label: string }>;

  const executiveActions = [
    canSeeBudgets ? { href: "/app/insights/budgets", label: "Budgets" } : null,
    canSeeBillApproval ? { href: "/app/bill-pay/bills?stage=approval", label: "Bills to approve" } : null,
    canSeeAccountingReview ? { href: "/app/accounting/review", label: "Accounting review" } : null,
    canSeeSpendQueue ? { href: "/app/spend/requests", label: "Spend requests" } : null,
    { href: "/app/inbox", label: "Open inbox" },
    { href: "/app/notifications", label: "Notifications" },
  ].filter(Boolean) as Array<{ href: string; label: string }>;

  const quickActions = executive ? executiveActions : personalActions;

  const companySection = canReport ? (
    <>
      <section className="overview-section" aria-labelledby="company-heading">
        <div className="overview-section-head">
          <h2 id="company-heading">{executive ? "Position" : "Company overview"}</h2>
          <span>{finance.data?.asOf ? `As of ${new Date(finance.data.asOf).toLocaleString()}` : "Loading…"}</span>
        </div>
        {finance.isError ? (
          <p className="error-panel" role="alert">Company totals could not load.</p>
        ) : (
          <div className="overview-stat-grid company">
            <article className={`overview-stat${executive ? " primary" : ""}`}>
              <span>Company cash</span>
              <strong>
                {finance.isPending
                  ? "…"
                  : finance.data?.companyCashError
                    ? "—"
                    : moneyList(finance.data?.companyCashByCurrency)}
              </strong>
              <small>
                {finance.data?.companyCashError
                  ? finance.data.companyCashError
                  : finance.data?.companyCashSource === "stripe"
                    ? `Stripe Issuing FA${finance.data.companyCashStatus ? ` · ${finance.data.companyCashStatus}` : ""}`
                    : finance.data?.companyCashSource === "bank_accounts"
                      ? "Local bank accounts (mock)"
                      : "Company cash unavailable"}
              </small>
            </article>
            {canSeeTxns ? (
              <Link href="/app/spend/transactions" className="overview-stat">
                <span>Cleared card spend</span>
                <strong>{finance.isPending ? "…" : moneyList(finance.data?.clearedSpendByCurrency)}</strong>
                <small>By transaction currency (synced from Stripe events)</small>
              </Link>
            ) : (
              <article className="overview-stat">
                <span>Cleared card spend</span>
                <strong>{finance.isPending ? "…" : moneyList(finance.data?.clearedSpendByCurrency)}</strong>
                <small>By transaction currency (synced from Stripe events)</small>
              </article>
            )}
            {canSeeBills || canSeeBillApproval ? (
              <Link href={canSeeBillApproval ? "/app/bill-pay/bills?stage=approval" : "/app/bill-pay/bills"} className="overview-stat">
                <span>Open payables</span>
                <strong>{finance.isPending ? "…" : moneyList(finance.data?.openPayablesByCurrency)}</strong>
                <small>{finance.data?.pendingBills ?? 0} bills pending approval</small>
              </Link>
            ) : (
              <article className="overview-stat">
                <span>Open payables</span>
                <strong>{finance.isPending ? "…" : moneyList(finance.data?.openPayablesByCurrency)}</strong>
                <small>{finance.data?.pendingBills ?? 0} bills pending approval</small>
              </article>
            )}
            {canSeeBudgets ? (
              <Link href="/app/insights/budgets" className="overview-stat">
                <span>Budget remaining</span>
                <strong>{finance.isPending ? "…" : moneyList(finance.data?.budgetCapacityByCurrency)}</strong>
                <small>Used {moneyList(finance.data?.budgetUsedByCurrency)} · internal budgets</small>
              </Link>
            ) : (
              <article className="overview-stat">
                <span>Budget remaining</span>
                <strong>{finance.isPending ? "…" : moneyList(finance.data?.budgetCapacityByCurrency)}</strong>
                <small>Used {moneyList(finance.data?.budgetUsedByCurrency)} · internal budgets</small>
              </article>
            )}
            {canSeePos ? (
              <Link href="/app/procurement/purchase-orders" className="overview-stat">
                <span>Open PO commitments</span>
                <strong>{finance.isPending ? "…" : moneyList(finance.data?.openPoCommitmentsByCurrency)}</strong>
                <small>Unbilled PO balance</small>
              </Link>
            ) : (
              <article className="overview-stat">
                <span>Open PO commitments</span>
                <strong>{finance.isPending ? "…" : moneyList(finance.data?.openPoCommitmentsByCurrency)}</strong>
                <small>Unbilled PO balance</small>
              </article>
            )}
            {canSeeAccounting && (
              <Link href="/app/accounting/overview" className="overview-stat">
                <span>Accounting review</span>
                <strong>{finance.isPending ? "…" : (finance.data?.accountingReview ?? "—")}</strong>
                <small>Entries needing attention</small>
              </Link>
            )}
            {canSeeIntegrations && (
              <Link href="/app/company/integrations" className="overview-stat">
                <span>Integrations</span>
                <strong>
                  {finance.isPending
                    ? "…"
                    : finance.data?.integrations
                      ? `${finance.data.integrations.healthy}/${finance.data.integrations.total}`
                      : "—"}
                </strong>
                <small>{finance.data?.integrations?.degraded ?? 0} degraded</small>
              </Link>
            )}
          </div>
        )}
      </section>

      <div className="overview-split">
        <section className="overview-panel" aria-labelledby="queues-heading">
          <h2 id="queues-heading">Action queues</h2>
          {canSeeSpendQueue && (
            <Link href="/app/spend/requests"><span>Spend requests</span><strong>{finance.data?.pendingRequests ?? "—"}</strong></Link>
          )}
          {canSeeBillApproval && (
            <Link href="/app/bill-pay/bills?stage=approval"><span>Bills for approval</span><strong>{finance.data?.pendingBills ?? "—"}</strong></Link>
          )}
          {canSeeTravelQueue && (
            <Link href="/app/travel/requests"><span>Travel pending</span><strong>{finance.data?.travelPending ?? "—"}</strong></Link>
          )}
          {canSeeAccounting && (
            <Link href="/app/accounting/overview"><span>Accounting review</span><strong>{finance.data?.accountingReview ?? "—"}</strong></Link>
          )}
          {!canSeeSpendQueue && !canSeeBillApproval && !canSeeTravelQueue && !canSeeAccounting && (
            <p className="muted" style={{ margin: "8px 0 0" }}>No company queues in your access.</p>
          )}
        </section>
        <section className="overview-panel muted-panel" aria-labelledby="freshness-heading">
          <h2 id="freshness-heading">Freshness</h2>
          <p>Dashboard as of {finance.data?.asOf ? new Date(finance.data.asOf).toLocaleString() : "—"}</p>
          <p>Budget read model {finance.data?.freshness?.budgetFreshness ? new Date(finance.data.freshness.budgetFreshness).toLocaleString() : "—"}</p>
          <p>Currency totals are server-calculated. Actual and committed budget amounts are not double-counted.</p>
          <div className="overview-panel-links">
            {canSeeIntegrations && <Link href="/app/company/integrations">Integration health</Link>}
            {canSeeBudgets && <Link href="/app/insights/budgets">Budgets</Link>}
            {canSeeAudit && <Link href="/app/company/audit">Audit log</Link>}
          </div>
        </section>
      </div>
    </>
  ) : null;

  const myWorkSection = (
    <section className="overview-section" aria-labelledby="my-work-heading">
      <div className="overview-section-head">
        <h2 id="my-work-heading">{executive ? "Your work" : "My work"}</h2>
        <span>Personal balances and status</span>
      </div>
      <div className="overview-stat-grid">
        <Link href="/app/me/cards" className={`overview-stat${!executive ? " primary" : ""}`}>
          <span>Available funds</span>
          <strong>{mine.isPending ? "…" : funds.value}</strong>
          <small>{funds.hint ?? ((mine.data?.cards ?? 0) > 0 ? "Your virtual card" : "No card yet")}</small>
        </Link>
        <Link href="/app/me/expenses" className="overview-stat">
          <span>Open expenses</span>
          <strong>{mine.isPending ? "…" : (mine.data?.openExpenses ?? 0)}</strong>
          <small>Receipts and review</small>
        </Link>
        {canCreateSpend ? (
          <Link href="/app/me/requests" className="overview-stat">
            <span>My requests</span>
            <strong>{mine.isPending ? "…" : (mine.data?.pendingRequests ?? 0)}</strong>
            <small>Awaiting a decision</small>
          </Link>
        ) : canApproveSpend && canSeeSpendQueue ? (
          <Link href="/app/spend/requests" className="overview-stat">
            <span>Spend requests</span>
            <strong>{mine.isPending ? "…" : (finance.data?.pendingRequests ?? mine.data?.pendingRequests ?? 0)}</strong>
            <small>Company / reports queue</small>
          </Link>
        ) : (
          <article className="overview-stat">
            <span>My requests</span>
            <strong>{mine.isPending ? "…" : (mine.data?.pendingRequests ?? 0)}</strong>
            <small>No create access</small>
          </article>
        )}
        <Link href="/app/notifications" className="overview-stat">
          <span>Notifications</span>
          <strong>{notifications.isPending ? "…" : unread}</strong>
          <small>Unread for you</small>
        </Link>
      </div>
    </section>
  );

  return (
    <div className={`overview-page${executive ? " overview-executive" : ""}`}>
      <header className="overview-hero">
        <div>
          <p className="overview-kicker">{executive ? "Insights · Executive view" : todayLabel}</p>
          <h1>{executive ? "Company finance overview" : `${greetingForHour()}, ${name}`}</h1>
          <p className="overview-lead">
            {executive
              ? "Currency-scoped totals, budget capacity, and queues you are allowed to act on."
              : "Finish your tasks, check balances, and move spend forward — all in one place."}
          </p>
        </div>
        <div className="overview-quick-actions" aria-label="Quick actions">
          {quickActions.map((action) => (
            <Link key={action.href + action.label} href={action.href} className="overview-chip">
              {action.label}
            </Link>
          ))}
        </div>
      </header>

      {mine.isError && <p className="error-panel" role="alert">Your workspace summary could not load.</p>}

      <section className="overview-section" aria-labelledby="attention-heading">
        <div className="overview-section-head">
          <h2 id="attention-heading">Needs your attention</h2>
          <span>{attention.length ? `${attention.length} item${attention.length === 1 ? "" : "s"}` : "You're caught up"}</span>
        </div>
        {inbox.isError && <p className="error-panel" role="alert">Inbox could not load.</p>}
        {!attention.length ? (
          <div className="overview-empty">
            <strong>All clear</strong>
            <p>No open tasks right now. Use a quick action above when you need to spend, reimburse, or review.</p>
          </div>
        ) : (
          <ul className="overview-task-list">
            {attention.map((item) => (
              <li key={item.href + item.label}>
                <Link href={item.href} className={`overview-task${item.tone === "urgent" ? " urgent" : ""}`}>
                  <div>
                    <strong>{item.label}</strong>
                    <span>{item.detail}</span>
                  </div>
                  <em>{item.count}</em>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {executive ? (
        <>
          {companySection}
          {myWorkSection}
        </>
      ) : (
        <>
          {myWorkSection}
          {companySection}
        </>
      )}
    </div>
  );
}
