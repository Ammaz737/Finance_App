"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { QueryProvider } from "@/providers/query-provider";
import { SessionGate, useSession } from "@/providers/session-provider";
import { canSeeItem, navigation } from "@/config/navigation";
import { api, setToken } from "@/lib/api";

function Shell({ children }: { children: ReactNode }) {
  const session = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const notifications = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.get<Array<{ readAt: string | null }>>("/notifications"),
    refetchInterval: 60_000,
  });
  if (!session) return null;
  const current = navigation.flatMap((section) => section.items).find((item) => item.href === pathname);
  const forbidden = Boolean(current && !canSeeItem(current, session));
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
              {items.map((item) => <Link key={item.href} className={`nav-link${pathname === item.href ? " active" : ""}`} href={item.href} aria-current={pathname === item.href ? "page" : undefined}>{item.label}</Link>)}
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
            <span className="eyebrow">403 · Access denied</span>
            <h1>You do not have access to this page</h1>
            <p>Your role or enabled product features do not allow this route.</p>
            <Link className="btn btn-primary" href="/app/home">Return to overview</Link>
          </section> : children}
        </main>
      </div>
    </div>
  );
}

export default function AppShellLayout({ children }: { children: ReactNode }) {
  return <QueryProvider><SessionGate><Shell>{children}</Shell></SessionGate></QueryProvider>;
}
