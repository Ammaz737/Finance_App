"use client";

import type { ReactNode } from "react";
import { useSession } from "@/providers/session-provider";

type CanProps = {
  permission: string;
  children: ReactNode;
};

/** UX-only permission gate. Backend remains the final authority. */
export function Can({ permission, children }: CanProps) {
  const session = useSession();
  if (!session || (!session.roles.includes("Owner") && !session.permissions.includes("*") && !session.permissions.includes(permission))) {
    return null;
  }
  return <>{children}</>;
}
