import type { Request } from "express";

export type ActorType = "INTERNAL_USER" | "VENDOR_USER" | "ADVISOR_USER" | "OAUTH_APP" | "AI_AGENT_IDENTITY";

export type RequestContext = {
  actorType: ActorType;
  userId: string;
  organizationId: string;
  entityIds: string[];
  roles: string[];
  permissions: string[];
  grants: Array<{ permission: string; scope: string; entityId: string | null }>;
  entitlements: string[];
  sessionId: string;
  correlationId: string;
};

export function getContext(req: Request): RequestContext {
  const ctx = (req as Request & { context?: RequestContext }).context;
  if (!ctx) {
    throw new Error("UNAUTHENTICATED");
  }
  return ctx;
}
