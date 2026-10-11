"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { canSeeItem, findNavItem } from "@/config/navigation";
import { api } from "@/lib/api";
import { useSession } from "@/providers/session-provider";
import { NavigationIcon } from "@/components/NavigationIcon";

const overviewIcons: Record<string, string> = {
  "Request spend": "Travel", "Complete expenses": "Receipts", "New reimbursement": "My work",
  "Book travel": "Travel", "Create bill": "Bills", "Open inbox": "Inbox",
  "Inbox approvals": "Inbox", "Expenses to complete": "Receipts", "Your pending requests": "Requests",
  "Unread notifications": "Notifications", "Bills for approval": "Bills", "Bills to approve": "Bills",
  "Accounting review": "Accounting", "Travel pending": "Travel", "Spend requests": "Funds",
  "Company cash": "Funds", "Cleared card spend": "Cards", "Open payables": "Bills",
  "Budget remaining": "Budgets", "Open PO commitments": "Procurement", "Integrations": "Integrations",
  "Available funds": "Cards", "Open expenses": "Receiving", "My requests": "Requests",
};

const overviewPaths: Record<string, string> = {
  "Book travel": "m22 2-7 7-6-2-2 2 5 3-4 4-4-1-2 2 5 3 3 5 2-2-1-4 4-4 3 5 2-2-2-6 7-7Z",
  "Travel pending": "m22 2-7 7-6-2-2 2 5 3-4 4-4-1-2 2 5 3 3 5 2-2-1-4 4-4 3 5 2-2-2-6 7-7Z",
  "Open expenses": "M3 7V5h6l2 3h10v12H3V7ZM3 11h18",
  "Accounting review": "M6 3h12v18H6zM9 7h6M9 11h6M9 15h3m-3 3h1",
  "Budget remaining": "M12 2v10h10A10 10 0 0 0 12 2ZM8 3a10 10 0 1 0 13 13H8V3Z",
};

function OverviewSymbol({ label }: { label: string }) {
  return <span className="overview-symbol" data-icon={overviewIcons[label] ?? label}>{overviewPaths[label] ? <svg className="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={overviewPaths[label]} /></svg> : <NavigationIcon label={overviewIcons[label] ?? label} />}</span>;
}

function StatLabel({ children }: { children: string }) {
  return <span className="overview-stat-label"><OverviewSymbol label={children} />{children}</span>;
}

function Chevron() {
  return <svg className="overview-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg>;
}

function CardArtwork() {
  return <div className="overview-card-art" aria-hidden="true"><div className="overview-card-outline" /><div className="overview-virtual-card"><span>VIRTUAL</span><i /><div className="overview-card-dots">•••• &nbsp; •••• &nbsp; ••••</div><b /><b /></div></div>;
}

function BudgetRing({ remaining, used }: { remaining?: MoneyTotal[]; used?: MoneyTotal[] }) {
  if (remaining?.length !== 1) return null;
  const balance = Number(remaining[0].amount);
  const matching = used?.find((item) => item.currency === remaining[0].currency);
  if (!matching) return null;
  const spent = Number(matching.amount);
  const total = balance + spent;
  if (!Number.isFinite(total) || !Number.isFinite(balance) || total <= 0) return null;
  const percentage = Math.round(Math.max(0, Math.min(100, balance / total * 100)));
  return <span className="overview-budget-ring" role="img" aria-label={`${percentage}% budget remaining`}><svg viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="18" /><circle cx="22" cy="22" r="18" pathLength="100" strokeDasharray={`${percentage} 100`} /></svg><b>{percentage}%</b></span>;
}

function WorkCardFooter({ children, count }: { children: string; count: number }) {
  return <span className={`overview-work-footer${count > 0 ? " has-pending" : ""}`}><span><i aria-hidden="true" />{count > 0 ? "Needs attention" : "All caught up"}</span><span>{children} <span aria-hidden="true">→</span></span></span>;
}

function FreshnessTimestamp({ label, value, pending }: { label: string; value?: string; pending: boolean }) {
  const date = value ? new Date(value) : null;
  const valid = date && Number.isFinite(date.getTime());
  return <div className="overview-freshness-row"><span className="overview-freshness-dot" aria-hidden="true" /><span className="overview-freshness-label">{label}</span>{valid ? <time dateTime={value} title={date.toLocaleString()}><strong>{date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", second: "2-digit" })}</strong><span>{date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span></time> : <span className="overview-freshness-unavailable">{pending ? "Loading…" : "Unavailable"}</span>}</div>;
}

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
      <section className="overview-section overview-company" aria-labelledby="company-heading">
        <div className="overview-section-head">
          <h2 id="company-heading">{executive ? "Position" : "Company overview"}</h2>
          <span>{finance.data?.asOf ? `As of ${new Date(finance.data.asOf).toLocaleString()}` : "Loading…"}</span>
        </div>
        {finance.isError ? (
          <p className="error-panel" role="alert">Company totals could not load.</p>
        ) : (
          <div className="overview-stat-grid company">
            <article className={`overview-stat${executive ? " primary" : ""}`}>
              <StatLabel>Company cash</StatLabel>
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
                <StatLabel>Cleared card spend</StatLabel>
                <strong>{finance.isPending ? "…" : moneyList(finance.data?.clearedSpendByCurrency)}</strong>
                <small>By transaction currency (synced from Stripe events)</small>
              </Link>
            ) : (
              <article className="overview-stat">
                <StatLabel>Cleared card spend</StatLabel>
                <strong>{finance.isPending ? "…" : moneyList(finance.data?.clearedSpendByCurrency)}</strong>
                <small>By transaction currency (synced from Stripe events)</small>
              </article>
            )}
            {canSeeBills || canSeeBillApproval ? (
              <Link href={canSeeBillApproval ? "/app/bill-pay/bills?stage=approval" : "/app/bill-pay/bills"} className="overview-stat">
                <StatLabel>Open payables</StatLabel>
                <strong>{finance.isPending ? "…" : moneyList(finance.data?.openPayablesByCurrency)}</strong>
                <small>{finance.data?.pendingBills ?? 0} bills pending approval</small>
              </Link>
            ) : (
              <article className="overview-stat">
                <StatLabel>Open payables</StatLabel>
                <strong>{finance.isPending ? "…" : moneyList(finance.data?.openPayablesByCurrency)}</strong>
                <small>{finance.data?.pendingBills ?? 0} bills pending approval</small>
              </article>
            )}
            {canSeeBudgets ? (
              <Link href="/app/insights/budgets" className={`overview-stat${finance.data?.budgetCapacityByCurrency?.length === 1 && finance.data?.budgetUsedByCurrency?.some((item) => item.currency === finance.data?.budgetCapacityByCurrency?.[0].currency) ? " overview-budget-stat" : ""}`}>
                <StatLabel>Budget remaining</StatLabel>
                <strong>{finance.isPending ? "…" : moneyList(finance.data?.budgetCapacityByCurrency)}</strong>
                <small>Used {moneyList(finance.data?.budgetUsedByCurrency)} · internal budgets</small>
                <BudgetRing remaining={finance.data?.budgetCapacityByCurrency} used={finance.data?.budgetUsedByCurrency} />
              </Link>
            ) : (
              <article className={`overview-stat${finance.data?.budgetCapacityByCurrency?.length === 1 && finance.data?.budgetUsedByCurrency?.some((item) => item.currency === finance.data?.budgetCapacityByCurrency?.[0].currency) ? " overview-budget-stat" : ""}`}>
                <StatLabel>Budget remaining</StatLabel>
                <strong>{finance.isPending ? "…" : moneyList(finance.data?.budgetCapacityByCurrency)}</strong>
                <small>Used {moneyList(finance.data?.budgetUsedByCurrency)} · internal budgets</small>
                <BudgetRing remaining={finance.data?.budgetCapacityByCurrency} used={finance.data?.budgetUsedByCurrency} />
              </article>
            )}
            {canSeePos ? (
              <Link href="/app/procurement/purchase-orders" className="overview-stat">
                <StatLabel>Open PO commitments</StatLabel>
                <strong>{finance.isPending ? "…" : moneyList(finance.data?.openPoCommitmentsByCurrency)}</strong>
                <small>Unbilled PO balance</small>
              </Link>
            ) : (
              <article className="overview-stat">
                <StatLabel>Open PO commitments</StatLabel>
                <strong>{finance.isPending ? "…" : moneyList(finance.data?.openPoCommitmentsByCurrency)}</strong>
                <small>Unbilled PO balance</small>
              </article>
            )}
            {canSeeAccounting && (
              <Link href="/app/accounting/overview" className="overview-stat">
                <StatLabel>Accounting review</StatLabel>
                <strong>{finance.isPending ? "…" : (finance.data?.accountingReview ?? "—")}</strong>
                <small>Entries needing attention</small>
              </Link>
            )}
            {canSeeIntegrations && (
              <Link href="/app/company/integrations" className="overview-stat">
                <StatLabel>Integrations</StatLabel>
                <strong>
                  {finance.isPending
                    ? "…"
                    : finance.data?.integrations
                      ? `${finance.data.integrations.healthy}/${finance.data.integrations.total}`
                      : "—"}
                </strong>
                <small>{finance.data?.integrations?.degraded ?? 0} degraded</small>
                {finance.data?.integrations && finance.data.integrations.total > 0 && <span className={`overview-health-badge${finance.data.integrations.healthy < finance.data.integrations.total ? " degraded" : ""}`}><i aria-hidden="true" />{finance.data.integrations.healthy < finance.data.integrations.total ? "Needs attention" : "Systems healthy"}</span>}
              </Link>
            )}
          </div>
        )}
      </section>

      <div className="overview-split">
        <section className="overview-panel overview-activity" aria-labelledby="activity-heading">
          <div className="overview-section-head"><h2 id="activity-heading">Spend activity</h2><span>Cleared spend by currency</span></div>
          {finance.isPending ? <p className="muted" role="status">Loading spend activity…</p> : finance.isError ? <p className="muted">Spend activity could not load.</p> : finance.data?.clearedSpendByCurrency.length ? (
            <div className="overview-bars">
              {finance.data.clearedSpendByCurrency.map((total) => {
                const maximum = Math.max(1, ...finance.data.clearedSpendByCurrency.map((item) => Math.abs(Number(item.amount)) || 0));
                return <div className="overview-bar-column" key={total.currency}><strong>{moneyList([total])}</strong><div className="overview-bar-track"><div className="overview-bar" style={{ height: `${Math.max(0, Math.abs(Number(total.amount)) / maximum * 100)}%` }} /></div><span>{total.currency}</span></div>;
              })}
            </div>
          ) : <div className="overview-activity-empty"><NavigationIcon label="Insights" /><p>No cleared spend yet</p></div>}
        </section>
        <section className="overview-panel overview-queues" aria-labelledby="queues-heading">
          <h2 id="queues-heading">Action queues</h2>
          {canSeeSpendQueue && (
            <Link href="/app/spend/requests"><span className="overview-queue-label"><OverviewSymbol label="Spend requests" />Spend requests</span><strong>{finance.data?.pendingRequests ?? "—"}</strong></Link>
          )}
          {canSeeBillApproval && (
            <Link href="/app/bill-pay/bills?stage=approval"><span className="overview-queue-label"><OverviewSymbol label="Bills for approval" />Bills for approval</span><strong>{finance.data?.pendingBills ?? "—"}</strong></Link>
          )}
          {canSeeTravelQueue && (
            <Link href="/app/travel/requests"><span className="overview-queue-label"><OverviewSymbol label="Travel pending" />Travel pending</span><strong>{finance.data?.travelPending ?? "—"}</strong></Link>
          )}
          {canSeeAccounting && (
            <Link href="/app/accounting/overview"><StatLabel>Accounting review</StatLabel><strong>{finance.data?.accountingReview ?? "—"}</strong></Link>
          )}
          {!canSeeSpendQueue && !canSeeBillApproval && !canSeeTravelQueue && !canSeeAccounting && (
            <p className="muted" style={{ margin: "8px 0 0" }}>No company queues in your access.</p>
          )}
        </section>
        <section className="overview-panel overview-freshness" aria-labelledby="freshness-heading">
          <div className="overview-freshness-head"><div><span className="overview-freshness-icon"><NavigationIcon label="History" /></span><h2 id="freshness-heading">Freshness</h2></div><span className="overview-snapshot-badge">Data snapshot</span></div>
          <div className="overview-freshness-times">
            <FreshnessTimestamp label="Dashboard updated" value={finance.data?.asOf} pending={finance.isPending} />
            <FreshnessTimestamp label="Budgets updated" value={finance.data?.freshness?.budgetFreshness} pending={finance.isPending} />
          </div>
          <div className="overview-freshness-note"><NavigationIcon label="Policies" /><p>Currency totals are server-calculated. Actual and committed budget amounts are not double-counted.</p></div>
          <div className="overview-panel-links">
            {canSeeIntegrations && <Link href="/app/company/integrations">Integration health <span aria-hidden="true">↗</span></Link>}
            {canSeeBudgets && <Link href="/app/insights/budgets">Budgets <span aria-hidden="true">↗</span></Link>}
            {canSeeAudit && <Link href="/app/company/audit">Audit log <span aria-hidden="true">↗</span></Link>}
          </div>
        </section>
      </div>
    </>
  ) : null;

  const myWorkSection = (
    <section className="overview-section overview-personal" aria-labelledby="my-work-heading">
      <div className="overview-section-head">
        <h2 id="my-work-heading">{executive ? "Your work" : "My work"}</h2>
        <span>Personal balances and status</span>
      </div>
      <div className="overview-stat-grid">
        <Link href="/app/me/cards" className={`overview-stat overview-funds${!executive ? " primary" : ""}`}>
          <StatLabel>Available funds</StatLabel>
          <strong>{mine.isPending ? "…" : funds.value}</strong>
          <small>{funds.hint ?? ((mine.data?.cards ?? 0) > 0 ? "Your virtual card" : "No card yet")}</small>
          <span className="overview-view-card">View card <span aria-hidden="true">→</span></span>
          <CardArtwork />
        </Link>
        <Link href="/app/me/expenses" className="overview-stat">
          <StatLabel>Open expenses</StatLabel>
          <strong>{mine.isPending ? "…" : (mine.data?.openExpenses ?? 0)}</strong>
          <small>Receipts and review</small>
          {!mine.isPending && !mine.isError && <WorkCardFooter count={mine.data?.openExpenses ?? 0}>View expenses</WorkCardFooter>}
        </Link>
        {canCreateSpend ? (
          <Link href="/app/me/requests" className="overview-stat">
            <StatLabel>My requests</StatLabel>
            <strong>{mine.isPending ? "…" : (mine.data?.pendingRequests ?? 0)}</strong>
            <small>Awaiting a decision</small>
            {!mine.isPending && !mine.isError && <WorkCardFooter count={mine.data?.pendingRequests ?? 0}>View requests</WorkCardFooter>}
          </Link>
        ) : canApproveSpend && canSeeSpendQueue ? (
          <Link href="/app/spend/requests" className="overview-stat">
            <StatLabel>Spend requests</StatLabel>
            <strong>{mine.isPending ? "…" : (finance.data?.pendingRequests ?? mine.data?.pendingRequests ?? 0)}</strong>
            <small>Company / reports queue</small>
            {!mine.isPending && !mine.isError && <WorkCardFooter count={finance.data?.pendingRequests ?? mine.data?.pendingRequests ?? 0}>View queue</WorkCardFooter>}
          </Link>
        ) : (
          <article className="overview-stat">
            <StatLabel>My requests</StatLabel>
            <strong>{mine.isPending ? "…" : (mine.data?.pendingRequests ?? 0)}</strong>
            <small>No create access</small>
          </article>
        )}
        <Link href="/app/notifications" className="overview-stat">
          <StatLabel>Notifications</StatLabel>
          <strong>{notifications.isPending ? "…" : unread}</strong>
          <small>Unread for you</small>
          {!notifications.isPending && !notifications.isError && <WorkCardFooter count={unread}>View updates</WorkCardFooter>}
        </Link>
      </div>
    </section>
  );

  return (
    <div className={`overview-page${executive ? " overview-executive" : ""}`}>
      <header className="overview-hero">
        <div>
          <p className="overview-kicker">{executive ? "Insights · Executive view" : todayLabel}</p>
          <h1>{executive ? "Company finance overview" : <>{greetingForHour()}, {name} <span className="overview-sun" aria-hidden="true">☀</span></>}</h1>
          <p className="overview-lead">
            {executive
              ? "Currency-scoped totals, budget capacity, and queues you are allowed to act on."
              : "Finish your tasks, check balances, and move spend forward — all in one place."}
          </p>
        </div>
        <div className="overview-quick-actions" aria-label="Quick actions">
          {quickActions.map((action) => (
            <Link key={action.href + action.label} href={action.href} className="overview-chip">
              <OverviewSymbol label={action.label} /><span>{action.label}</span>{action.label === "Request spend" && <span aria-hidden="true">→</span>}
            </Link>
          ))}
        </div>
      </header>

      {mine.isError && <p className="error-panel" role="alert">Your workspace summary could not load.</p>}

      <section className="overview-section overview-attention" aria-labelledby="attention-heading">
        <div className="overview-section-head">
          <h2 id="attention-heading">Needs your attention</h2>
          <div className="overview-attention-meta"><span>{attention.length ? `${attention.length} item${attention.length === 1 ? "" : "s"}` : "You're caught up"}</span><Link href="/app/inbox">View all <span aria-hidden="true">→</span></Link></div>
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
                  <OverviewSymbol label={item.label} />
                  <div>
                    <strong>{item.label}</strong>
                    <span>{item.detail}</span>
                  </div>
                  <em>{item.count}</em>
                  <Chevron />
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
