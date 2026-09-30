"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader, StatusBadge } from "@finance/design-system";
import { canSeeItem, findNavItem } from "@/config/navigation";
import { api } from "@/lib/api";
import { useSession } from "@/providers/session-provider";

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string;
  href: string;
  readAt: string | null;
  createdAt: string;
};

function safeAppHref(href: string | null | undefined): string | null {
  if (!href) return null;
  const trimmed = href.trim();
  if (!trimmed.startsWith("/app/")) return null;
  if (trimmed.includes("//") || trimmed.includes("\\")) return null;
  return trimmed;
}

function relativeTime(iso: string) {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const delta = Date.now() - then;
  const minutes = Math.floor(delta / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

const focusLinks = [
  { href: "/app/notifications", label: "All", focus: null as string | null },
  { href: "/app/notifications?focus=unread", label: "Unread", focus: "unread" },
];

function NotificationsContent() {
  const search = useSearchParams();
  const session = useSession();
  const queryClient = useQueryClient();
  const focus = search.get("focus") === "unread" ? "unread" : null;

  const list = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.get<Notification[]>("/notifications"),
  });

  const markRead = useMutation({
    mutationFn: (id: string) => api.post(`/notifications/${id}/mark-read`, {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      void queryClient.invalidateQueries({ queryKey: ["finance-overview"] });
    },
  });

  const markAll = useMutation({
    mutationFn: () => api.post("/notifications/mark-all-read", {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      void queryClient.invalidateQueries({ queryKey: ["finance-overview"] });
    },
  });

  const allRows = list.data ?? [];
  const unread = allRows.filter((item) => !item.readAt).length;
  const rows = focus === "unread" ? allRows.filter((item) => !item.readAt) : allRows;

  const canSeeInbox = session
    ? canSeeItem(findNavItem("/app/inbox") ?? { href: "/app/inbox" }, session)
    : true;
  const canSeeDashboard = session
    ? canSeeItem(
        findNavItem("/app/insights/dashboard") ?? { href: "/app/insights/dashboard", permission: "report.read" },
        session,
      )
    : false;

  return (
    <div className="stack-lg linked-dest-page notifications-page">
      <div className="resource-heading">
        <PageHeader
          title="Notifications"
          subtitle={unread ? `${unread} unread · open a notification to jump to the source record` : "You are caught up"}
        />
        <button
          className="btn btn-ghost"
          type="button"
          disabled={markAll.isPending || unread === 0}
          onClick={() => markAll.mutate()}
        >
          Mark all read
        </button>
      </div>

      <div className="my-work-filters" role="toolbar" aria-label="Notification focus">
        {focusLinks.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`chip${focus === item.focus ? " chip-active" : ""}`}
          >
            {item.label}
            {item.focus === "unread" && unread > 0 ? <span className="chip-count">{unread}</span> : null}
          </Link>
        ))}
      </div>

      {list.isError && (
        <p className="error-panel" role="alert">
          Could not load notifications.{" "}
          <button type="button" className="text-button" onClick={() => void list.refetch()}>Try again</button>
        </p>
      )}
      {list.isPending && <p className="muted">Loading notifications…</p>}

      {!list.isPending && !rows.length && (
        <div className="empty-work">
          <strong>{focus === "unread" ? "No unread notifications" : "No notifications yet"}</strong>
          <p>
            {focus === "unread"
              ? "You're fully caught up. Switch to All to browse history."
              : "Approvals, payments, and exceptions show up here with deep links to the source record."}
          </p>
          <div className="detail-actions-top">
            {canSeeInbox && (
              <Link className="btn btn-ghost" href="/app/inbox">Open inbox</Link>
            )}
            {focus === "unread" && (
              <Link className="btn btn-ghost" href="/app/notifications">Show all</Link>
            )}
          </div>
        </div>
      )}

      {rows.length > 0 && (
        <ul className="notifications-list">
          {rows.map((item) => {
            const href = safeAppHref(item.href);
            return (
              <li key={item.id} className={item.readAt ? "notification-row" : "notification-row is-new"}>
                <div className="notification-row-main">
                  <div className="notification-row-top">
                    {item.readAt ? <StatusBadge status="READ" /> : <StatusBadge status="UNREAD" />}
                    <span className="search-type-pill">{item.type.replaceAll("_", " ")}</span>
                    <time className="muted" dateTime={item.createdAt} title={new Date(item.createdAt).toLocaleString()}>
                      {relativeTime(item.createdAt)}
                    </time>
                  </div>
                  <strong className="notification-title">{item.title}</strong>
                  <p className="notification-body">{item.body}</p>
                </div>
                <div className="notification-row-actions">
                  {href && (
                    <Link
                      className="btn btn-primary"
                      href={href}
                      onClick={() => { if (!item.readAt) markRead.mutate(item.id); }}
                    >
                      Open
                    </Link>
                  )}
                  {!item.readAt && (
                    <button
                      className="btn btn-ghost"
                      type="button"
                      disabled={markRead.isPending}
                      onClick={() => markRead.mutate(item.id)}
                    >
                      Mark read
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="muted my-expenses-hint">
        Notifications are personal to your account.{" "}
        {canSeeInbox && (
          <Link className="detail-link" href="/app/inbox">
            Inbox →
          </Link>
        )}{" "}
        {canSeeDashboard && (
          <Link className="detail-link" href="/app/insights/dashboard">
            Executive dashboard →
          </Link>
        )}
      </p>
    </div>
  );
}

export default function NotificationsPage() {
  return (
    <Suspense fallback={<p className="muted">Loading notifications…</p>}>
      <NotificationsContent />
    </Suspense>
  );
}
