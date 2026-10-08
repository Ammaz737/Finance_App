"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, type FormEvent } from "react";
import { NavigationIcon } from "@/components/NavigationIcon";

export function AppHeader({ user, unread, onSignOut }: {
  user: { firstName: string; lastName: string };
  unread: number;
  onSignOut: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const account = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    if (account.current) account.current.open = false;
  }, [pathname]);

  useEffect(() => {
    function closeOutside(event: PointerEvent) {
      if (account.current && !account.current.contains(event.target as Node)) account.current.open = false;
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && account.current?.open) {
        account.current.open = false;
        account.current.querySelector("summary")?.focus();
      }
    }
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = String(new FormData(event.currentTarget).get("q") ?? "").trim();
    router.push(`/app/search${query ? `?q=${encodeURIComponent(query)}` : ""}`);
  }

  return (
    <header className="topbar">
      <form className="topbar-search" role="search" aria-label="Workspace search" onSubmit={search}>
        <NavigationIcon label="Search" />
        <input type="search" name="q" aria-label="Search workspace" placeholder="Search" autoComplete="off" />
      </form>
      <div className="topbar-actions">
        <Link className="topbar-link" href="/app/inbox" aria-label="Inbox">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 5h18v14H3zM3 5l9 7 9-7" /></svg>
          <span className="topbar-link-label">Inbox</span>
        </Link>
        <Link className="topbar-link" href="/app/notifications" aria-label={unread ? `${unread} unread notifications` : "Notifications"}>
          <NavigationIcon label="Notifications" />
          <span className="topbar-link-label">Notifications{unread > 0 ? ` (${unread})` : ""}</span>
          {unread > 0 && <span className="topbar-mobile-count" aria-hidden="true">{unread}</span>}
        </Link>
        <details className="topbar-account" ref={account} onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) event.currentTarget.open = false;
        }}>
          <summary className="topbar-account-trigger" aria-label={`Account for ${user.firstName} ${user.lastName}`}>
            <span className="avatar topbar-avatar" aria-hidden="true">{user.firstName.charAt(0)}{user.lastName.charAt(0)}</span>
            <span className="topbar-account-name">{user.firstName} {user.lastName}</span>
            <svg className="topbar-account-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
          </summary>
          <div className="topbar-account-panel">
            <span className="topbar-account-fullname">{user.firstName} {user.lastName}</span>
            <button type="button" onClick={onSignOut}>Sign out</button>
          </div>
        </details>
      </div>
    </header>
  );
}
