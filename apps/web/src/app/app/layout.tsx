"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { QueryProvider } from "@/providers/query-provider";
import { SessionGate, useSession } from "@/providers/session-provider";
import { canSeeItem, findNavItem, isUnfinishedProductRoute, navigation } from "@/config/navigation";
import { api, setToken } from "@/lib/api";

function Shell({ children }: { children: ReactNode }) {
  const session = useSession();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const notifications = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.get<Array<{ readAt: string | null }>>("/notifications"),
    refetchInterval: 60_000,
  });
  if (!session) return null;
  const query = searchParams.toString();
  const current = findNavItem(`${pathname}${query ? `?${query}` : ""}`);
  const unfinished = isUnfinishedProductRoute(pathname);
  // Nav permissions gate list/exact routes only. Detail deep-links (/:id) rely on API RBAC/ownership
  // so employees can open their own requests/trips without needing approve/list permissions.
  const exactNav = Boolean(current && new URL(current.href, "http://finance.local").pathname === pathname);
  const forbidden = Boolean(unfinished) || Boolean(exactNav && current && !canSeeItem(current, session));
  const unread = (notifications.data ?? []).filter((item) => !item.readAt).length;

  function signOut() {
    setToken(null);
    router.replace("/login");
  }

  return (
    <div className="shell">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <aside className="sidenav" aria-label="Primary navigation">
        <Link href="/app/home" className="brand"><span className="brand-mark">F</span><span>Finance<span className="brand-subtitle">Control center</span></span></Link>
        <nav>
          {navigation.map((section) => {
            const items = section.items.filter((item) => canSeeItem(item, session));
            if (!items.length) return null;
            return <div className="nav-section" key={section.label}>
              <div className="nav-label">{section.label}</div>
              {items.map((item) => {
                const active = current?.href === item.href;
                return <Link key={item.href} className={`nav-link${active ? " active" : ""}`} href={item.href} aria-current={active ? "page" : undefined}>{item.label}</Link>;
              })}
            </div>;
          })}
        </nav>
        <div className="sidenav-footer"><span className="avatar" aria-hidden="true">{session.user.firstName.charAt(0)}{session.user.lastName.charAt(0)}</span><div><strong>{session.user.firstName} {session.user.lastName}</strong><small>{session.roles.join(", ")}</small></div></div>
      </aside>
      <div className="shell-main">
        <header className="topbar">
          <div><span className="topbar-eyebrow">Workspace</span><strong>{current?.label ?? "Finance"}</strong></div>
          <div className="topbar-actions">
            <Link href="/app/search">Search</Link>
            <Link href="/app/inbox">Inbox</Link>
            <Link href="/app/notifications" aria-label={unread ? `${unread} unread notifications` : "Notifications"}>
              Notifications{unread > 0 ? ` (${unread})` : ""}
            </Link>
            <button type="button" className="text-button" onClick={signOut}>Sign out</button>
          </div>
        </header>
        <main id="main-content" className="content" tabIndex={-1}>
          {forbidden ? <section className="access-denied" role="alert">
            <span className="eyebrow">{unfinished ? `${unfinished} · Not enabled` : "403 · Access denied"}</span>
            <h1>{unfinished ? "This product area is not part of P0" : "You do not have access to this page"}</h1>
            <p>{unfinished
              ? "Scaffolds for later phases stay in the repo but are hidden until feature flags enable them."
              : "Your role, entity scope, or enabled product features do not allow this route."}</p>
            <div className="detail-actions">
              <Link className="btn btn-primary" href="/app/home">Return to overview</Link>
              <Link className="btn btn-ghost" href="/app/inbox">Open inbox</Link>
            </div>
          </section> : children}
        </main>
      </div>
    </div>
  );
}

export default function AppShellLayout({ children }: { children: ReactNode }) {
  return <QueryProvider><SessionGate><Shell>{children}</Shell></SessionGate></QueryProvider>;
}
