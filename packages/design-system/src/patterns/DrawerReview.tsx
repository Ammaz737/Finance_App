"use client";

import type { ReactNode } from "react";

export function DrawerReview({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <aside className="drawer">
      <div className="drawer-header">
        <h2>{title}</h2>
        <button className="btn btn-ghost" onClick={onClose} type="button">
          Close
        </button>
      </div>
      <div className="drawer-body">{children}</div>
    </aside>
  );
}
