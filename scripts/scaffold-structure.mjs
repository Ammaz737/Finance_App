/**
 * One-shot scaffold for the V3 on-prem modular monolith.
 * Run from repo root: node scripts/scaffold-structure.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function write(rel, contents) {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, contents.endsWith("\n") ? contents : `${contents}\n`, "utf8");
}

function kebabToPascal(name) {
  return name
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function toFilePrefix(mod) {
  const irregular = {
    people: "people",
    rbac: "rbac",
    identity: "identity",
    policies: "policy",
    entities: "entity",
    approvals: "approval",
    budgets: "budget",
    entitlements: "entitlement",
    cards: "card",
    funds: "fund",
    authorizations: "authorization",
    transactions: "transaction",
    disputes: "dispute",
    repayments: "repayment",
    expenses: "expense",
    receipts: "receipt",
    reimbursements: "reimbursement",
    procurement: "procurement",
    receiving: "receiving",
    vendors: "vendor",
    contracts: "contract",
    renewals: "renewal",
    sourcing: "sourcing",
    bills: "bill",
    payments: "payment",
    travel: "travel",
    banking: "banking",
    treasury: "treasury",
    accounting: "accounting",
    reconciliation: "reconciliation",
    customers: "customer",
    invoices: "invoice",
    collections: "collection",
    rewards: "reward",
    router: "router",
    sheets: "sheet",
    reporting: "reporting",
    search: "search",
    documents: "document",
    notifications: "notification",
    integrations: "integration",
    audit: "audit",
    ai: "ai",
    "country-capabilities": "country-capability",
    "spend-programs": "spend-program",
    "spend-requests": "spend-request",
    "purchase-orders": "purchase-order",
    "price-intelligence": "price-intelligence",
    "license-intelligence": "license-intelligence",
    "payment-runs": "payment-run",
    "erp-sync": "erp-sync",
    "cash-application": "cash-application",
    "tax-operations": "tax-operation",
    "ai-token-spend": "ai-token-spend",
    "agent-finance": "agent-finance",
    "developer-platform": "developer-platform",
  };
  if (irregular[mod]) return irregular[mod];
  if (mod.endsWith("ies")) return `${mod.slice(0, -3)}y`;
  if (mod.endsWith("s") && !mod.endsWith("ss")) return mod.slice(0, -1);
  return mod;
}

function toExportName(prefix) {
  return prefix
    .split("-")
    .map((part, i) => (i === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join("");
}

const modules = [
  "identity",
  "organizations",
  "entities",
  "people",
  "rbac",
  "policies",
  "approvals",
  "budgets",
  "entitlements",
  "country-capabilities",
  "cards",
  "funds",
  "spend-programs",
  "spend-requests",
  "authorizations",
  "transactions",
  "disputes",
  "repayments",
  "expenses",
  "receipts",
  "reimbursements",
  "procurement",
  "purchase-orders",
  "receiving",
  "vendors",
  "contracts",
  "renewals",
  "sourcing",
  "price-intelligence",
  "license-intelligence",
  "bills",
  "payments",
  "payment-runs",
  "travel",
  "banking",
  "treasury",
  "accounting",
  "reconciliation",
  "erp-sync",
  "customers",
  "invoices",
  "collections",
  "cash-application",
  "rewards",
  "tax-operations",
  "ai-token-spend",
  "router",
  "agent-finance",
  "sheets",
  "reporting",
  "search",
  "documents",
  "notifications",
  "integrations",
  "developer-platform",
  "audit",
  "ai",
];

const platform = [
  "auth",
  "rbac",
  "database",
  "events",
  "queue",
  "cache",
  "storage",
  "email",
  "push",
  "observability",
  "idempotency",
  "encryption",
  "secrets",
  "rate-limit",
  "pagination",
  "feature-flags",
];

const engines = ["policy", "workflow", "documents", "search", "ledger"];

const shared = ["errors", "types", "constants", "money", "date-time", "result", "identifiers", "country"];

const adapterFamilies = [
  "accounting",
  "hris",
  "identity",
  "bank-data",
  "payment-rail",
  "card-issuer",
  "travel",
  "email",
  "collaboration",
  "contract",
  "e-sign",
  "ai-usage",
  "llm",
  "data-export",
  "tax-filing",
  "sanctions-screening",
];

const aiAgents = [
  "policy-agent",
  "accounting-agent",
  "ap-agent",
  "procurement-agent",
  "contract-agent",
  "reporting-agent",
  "collections-agent",
  "inbox-agent",
];

const queues = [
  "notifications",
  "documents",
  "ocr",
  "integrations",
  "accounting-sync",
  "payments",
  "reporting",
  "ai",
  "webhooks",
  "search-index",
  "tax",
  "travel",
  "sheets",
  "disputes",
];

const webFeatures = [
  "home",
  "inbox",
  "search",
  "cards",
  "funds",
  "spend-programs",
  "spend-requests",
  "transactions",
  "expenses",
  "reimbursements",
  "travel",
  "procurement",
  "purchase-orders",
  "receiving",
  "sourcing",
  "vendors",
  "contracts",
  "bill-pay",
  "payments",
  "payment-runs",
  "accounting",
  "banking",
  "insights",
  "reports",
  "budgets",
  "savings",
  "price-intelligence",
  "license-intelligence",
  "receivables",
  "ask-ai",
  "token-spend",
  "router",
  "people",
  "roles",
  "policies",
  "approvals",
  "integrations",
  "security",
  "audit",
  "settings",
  "developer",
  "tax",
  "disputes",
  "rewards",
  "sheets",
  "agent-finance",
];

const webPages = [
  "app/home",
  "app/inbox",
  "app/search",
  "app/me/cards",
  "app/me/expenses",
  "app/me/requests",
  "app/me/reimbursements",
  "app/me/travel",
  "app/spend/cards",
  "app/spend/funds",
  "app/spend/programs",
  "app/spend/requests",
  "app/spend/transactions",
  "app/expenses/transactions",
  "app/expenses/reimbursements",
  "app/expenses/travel",
  "app/procurement/requests",
  "app/procurement/programs",
  "app/procurement/purchase-orders",
  "app/procurement/receiving",
  "app/procurement/sourcing",
  "app/procurement/contracts",
  "app/procurement/renewals",
  "app/vendors",
  "app/bill-pay/bills",
  "app/bill-pay/payments",
  "app/bill-pay/payment-runs",
  "app/bill-pay/recurring",
  "app/bill-pay/settings",
  "app/travel/search",
  "app/travel/requests",
  "app/travel/trips",
  "app/travel/travelers",
  "app/travel/policy",
  "app/travel/reports",
  "app/accounting/overview",
  "app/accounting/card",
  "app/accounting/reimbursements",
  "app/accounting/bill-pay",
  "app/accounting/banking",
  "app/accounting/review",
  "app/accounting/ready-to-sync",
  "app/accounting/synced",
  "app/accounting/errors",
  "app/accounting/rules",
  "app/accounting/integrations",
  "app/banking/accounts",
  "app/banking/transactions",
  "app/banking/transfers",
  "app/banking/automations",
  "app/banking/forecast",
  "app/banking/statements",
  "app/insights/dashboard",
  "app/insights/reports",
  "app/insights/budgets",
  "app/insights/savings",
  "app/insights/price-intelligence",
  "app/insights/license-intelligence",
  "app/receivables/customers",
  "app/receivables/invoices",
  "app/receivables/collections",
  "app/receivables/payments",
  "app/receivables/cash-application",
  "app/ai/ask",
  "app/ai/activity",
  "app/ai/token-spend",
  "app/ai/router",
  "app/ai/agents",
  "app/ai/sheets",
  "app/company/people",
  "app/company/departments",
  "app/company/locations",
  "app/company/entities",
  "app/company/rewards",
  "app/company/roles",
  "app/company/policy",
  "app/company/approvals",
  "app/company/integrations",
  "app/company/security",
  "app/company/audit",
  "app/company/billing",
  "app/company/settings",
  "app/developer",
  "app/tax",
  "app/disputes",
];

const vendorPortalPages = [
  "profile",
  "payment-tax",
  "bills",
  "comments",
  "documents",
];

const advisorPages = [
  "clients",
  "people",
  "reporting",
  "projects",
  "knowledge",
  "billing",
  "price-intelligence",
  "academy",
  "referrals",
];

const stackPages = [
  "workspaces",
  "close-projects",
  "reconciliations",
  "tasks",
  "skills",
  "reports",
  "usage",
];

const mobilePages = [
  "(tabs)/home",
  "(tabs)/cards",
  "(tabs)/expenses",
  "(tabs)/approvals",
  "(tabs)/more",
  "cards/[id]",
  "cards/[id]/funds",
  "transactions/[id]",
  "expenses/[id]",
  "expenses/scan",
  "reimbursements/new",
  "reimbursements/[id]",
  "requests/new",
  "requests/[id]",
  "approvals/[id]",
  "travel/search",
  "travel/trips",
  "travel/trips/[id]",
  "ai/ask",
  "settings/profile",
  "settings/notifications",
  "settings/security",
];

function placeholderTs(comment) {
  return `/** ${comment} */\nexport {};\n`;
}

function nextPage(title) {
  return `export default function Page() {
  return (
    <main>
      <h1>${title}</h1>
      <p>Scaffolded from the on-premises modular architecture guide. Domain logic is not implemented yet.</p>
    </main>
  );
}
`;
}

function featureIndex(name) {
  return `/** Web feature: ${name}. Import only from this barrel. */
export {};
`;
}

// --- API modules ---
for (const mod of modules) {
  const prefix = toFilePrefix(mod);
  const exportName = toExportName(prefix);
  const base = `apps/api/src/modules/${mod}`;

  write(
    `${base}/api/${prefix}.controller.ts`,
    `import type { Request, Response } from "express";

export function ${exportName}Controller(_req: Request, res: Response): void {
  res.status(501).json({
    error: {
      code: "NOT_IMPLEMENTED",
      message: "Module '${mod}' is scaffolded. Implement application use cases next.",
    },
  });
}
`,
  );

  write(
    `${base}/api/${prefix}.routes.ts`,
    `import { Router } from "express";
import { ${exportName}Controller } from "./${prefix}.controller";

export const ${exportName}Router = Router();

${exportName}Router.get("/", ${exportName}Controller);
`,
  );

  write(
    `${base}/api/${prefix}.schema.ts`,
    `/** Zod request/response contracts for ${mod} live here and should re-export from @finance/contracts. */
export {};
`,
  );

  write(
    `${base}/api/${prefix}.presenter.ts`,
    `/** Maps domain objects to API responses for ${mod}. */
export {};
`,
  );

  write(`${base}/application/commands/.gitkeep`, "");
  write(`${base}/application/queries/.gitkeep`, "");
  write(
    `${base}/application/services/${prefix}.service.ts`,
    `/** Application orchestration for ${mod}. No HTTP or Prisma types here. */
export class ${kebabToPascal(prefix)}Service {}
`,
  );

  write(`${base}/domain/entities/.gitkeep`, "");
  write(`${base}/domain/value-objects/.gitkeep`, "");
  write(`${base}/domain/policies/.gitkeep`, "");
  write(`${base}/domain/events/.gitkeep`, "");
  write(
    `${base}/domain/state-machine.ts`,
    `/** Deterministic state machine for ${mod}. Controllers must not set status strings directly. */
export const ${exportName}States = [] as const;
`,
  );
  write(
    `${base}/domain/repositories/${prefix}.repository.ts`,
    `/** Domain repository port for ${mod}. Implemented in infrastructure. */
export interface ${kebabToPascal(prefix)}Repository {}
`,
  );

  write(`${base}/infrastructure/repositories/.gitkeep`, "");
  write(`${base}/infrastructure/mappers/.gitkeep`, "");
  write(`${base}/infrastructure/adapters/.gitkeep`, "");
  write(`${base}/tests/unit/.gitkeep`, "");
  write(`${base}/tests/integration/.gitkeep`, "");

  write(
    `${base}/index.ts`,
    `/** Public API for the ${mod} module. Other modules must import only from here. */
export { ${exportName}Router as router } from "./api/${prefix}.routes";
`,
  );
}

// AI agents, tools, guardrails
for (const agent of aiAgents) {
  write(
    `apps/api/src/modules/ai/agents/${agent}/index.ts`,
    `/** ${agent}: tool-calling agent. Must use domain services; no unrestricted database access. */
export {};
`,
  );
}
write("apps/api/src/modules/ai/tools/index.ts", placeholderTs("Allowlisted AI tools"));
write("apps/api/src/modules/ai/providers/index.ts", placeholderTs("LLM provider adapters used by the orchestrator"));
write("apps/api/src/modules/ai/prompts/index.ts", placeholderTs("Versioned prompts / skills"));
write("apps/api/src/modules/ai/guardrails/index.ts", placeholderTs("AI safety: cannot release money, change bank details, or bypass RBAC"));
write("apps/api/src/modules/ai/evaluations/index.ts", placeholderTs("AI evaluation suites"));
write("apps/api/src/modules/ai/orchestrator.ts", placeholderTs("Agent orchestrator: permission context → approved tools → domain services → audit"));

// Engines
for (const engine of engines) {
  write(
    `apps/api/src/engines/${engine}/index.ts`,
    `/** Shared ${engine} engine. Business modules consume this; they do not reimplement it. */
export {};
`,
  );
}

// Platform
for (const item of platform) {
  write(
    `apps/api/src/platform/${item}/index.ts`,
    `/** Platform capability: ${item}. */
export {};
`,
  );
}
write(
  "apps/api/src/platform/storage/file-storage.ts",
  `export interface StoredFile {
  id: string;
  storagePath: string;
}

export interface FileStorage {
  upload(file: Buffer, meta: { name: string; mimeType: string }): Promise<StoredFile>;
  get(id: string): Promise<Buffer>;
  delete(id: string): Promise<void>;
}
`,
);
write(
  "apps/api/src/platform/storage/local-storage.adapter.ts",
  `import type { FileStorage, StoredFile } from "./file-storage";

export class LocalStorageAdapter implements FileStorage {
  async upload(_file: Buffer, _meta: { name: string; mimeType: string }): Promise<StoredFile> {
    throw new Error("LocalStorageAdapter.upload is not implemented");
  }
  async get(_id: string): Promise<Buffer> {
    throw new Error("LocalStorageAdapter.get is not implemented");
  }
  async delete(_id: string): Promise<void> {
    throw new Error("LocalStorageAdapter.delete is not implemented");
  }
}
`,
);

// Shared kernel
for (const item of shared) {
  write(
    `apps/api/src/shared/${item}/index.ts`,
    `/** Shared kernel primitive: ${item}. Business rules do not live here. */
export {};
`,
  );
}

// Integrations
for (const family of adapterFamilies) {
  const pascal = kebabToPascal(family);
  write(
    `apps/api/src/integrations/${family}/${family}.provider.ts`,
    `/** Normalized ${pascal} provider port. Domain modules depend on this, not a vendor SDK. */
export interface ${pascal}Provider {}
`,
  );
  write(
    `apps/api/src/integrations/${family}/mock.${family}.adapter.ts`,
    `import type { ${pascal}Provider } from "./${family}.provider";

export class Mock${pascal}Adapter implements ${pascal}Provider {}
`,
  );
  write(
    `apps/api/src/integrations/${family}/index.ts`,
    `export type { ${pascal}Provider } from "./${family}.provider";
export { Mock${pascal}Adapter } from "./mock.${family}.adapter";
`,
  );
}
write(
  "apps/api/src/integrations/index.ts",
  `${adapterFamilies
    .map((family) => `export * from "./${family}";`)
    .join("\n")}
`,
);

// Database / config / tests
write("apps/api/src/database/client.ts", `/** Prisma client singleton. */\nexport {};\n`);
write("apps/api/src/database/migrations/.gitkeep", "");
write("apps/api/src/config/env.ts", `export const env = {\n  nodeEnv: process.env.NODE_ENV ?? "development",\n};\n`);
write("apps/api/src/tests/setup.ts", placeholderTs("API test setup"));

const routeMounts = modules
  .map((mod) => {
    const prefix = toFilePrefix(mod);
    const exportName = toExportName(prefix);
    return `  api.use("/${mod}", ${exportName}Module.router);`;
  })
  .join("\n");

const routeImports = modules
  .map((mod) => {
    const prefix = toFilePrefix(mod);
    const exportName = toExportName(prefix);
    return `import * as ${exportName}Module from "../modules/${mod}";`;
  })
  .join("\n");

write(
  "apps/api/src/app/routes.ts",
  `import { Router } from "express";
${routeImports}

export function buildApiRouter(): Router {
  const api = Router();

${routeMounts}

  return api;
}
`,
);

write(
  "apps/api/src/app/app.ts",
  `import express from "express";
import { buildApiRouter } from "./routes";

export function createApp() {
  const app = express();
  app.use(express.json({ limit: "2mb" }));
  app.get("/health", (_req, res) => {
    res.json({ data: { status: "ok" } });
  });
  app.use("/api/v1", buildApiRouter());
  return app;
}
`,
);

write(
  "apps/api/src/app/bootstrap.ts",
  `/** Process bootstrap: config, database, queue, observability. */
export async function bootstrap(): Promise<void> {}
`,
);

write(
  "apps/api/src/app/server.ts",
  `import { createApp } from "./app";
import { bootstrap } from "./bootstrap";

const port = Number(process.env.PORT ?? 3001);

async function main() {
  await bootstrap();
  const app = createApp();
  app.listen(port, () => {
    console.log(\`API listening on :\${port}\`);
  });
}

void main();
`,
);

write(
  "apps/api/prisma/schema.prisma",
  `generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// Domain models belong in later migrations. Do not store PAN, CVV, or raw bank secrets.
`,
);

write(
  "apps/api/package.json",
  `{
  "name": "@finance/api",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/app/server.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/app/server.js",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@finance/config": "workspace:*",
    "@finance/contracts": "workspace:*",
    "@finance/logger": "workspace:*",
    "@finance/money": "workspace:*",
    "@finance/permissions": "workspace:*",
    "@prisma/client": "^6.16.0",
    "express": "^4.21.2",
    "zod": "^3.25.76"
  },
  "devDependencies": {
    "@types/express": "^4.17.23",
    "@types/node": "^22.18.1",
    "prisma": "^6.16.0",
    "tsx": "^4.20.5",
    "typescript": "^5.9.2",
    "vitest": "^3.2.4"
  }
}
`,
);

write(
  "apps/api/tsconfig.json",
  `{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "noEmit": false
  },
  "include": ["src"]
}
`,
);

// Worker
write(
  "apps/worker/src/index.ts",
  `/** Worker process: OCR, AI, ERP sync, webhooks, reports. Jobs must be retry-safe and idempotent. */
console.log("Worker process scaffolded");
`,
);
for (const queue of queues) {
  write(
    `apps/worker/src/queues/${queue}.queue.ts`,
    `/** BullMQ queue: ${queue}. Card authorization is synchronous and must not use this. */
export const ${toExportName(queue)}QueueName = "${queue}";
`,
  );
  write(
    `apps/worker/src/processors/${queue}.processor.ts`,
    `/** Processor for ${queue}. */
export async function process${kebabToPascal(queue)}Job(): Promise<void> {}
`,
  );
}
write(
  "apps/worker/package.json",
  `{
  "name": "@finance/worker",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "@finance/config": "workspace:*",
    "@finance/logger": "workspace:*",
    "bullmq": "^5.58.5",
    "ioredis": "^5.7.0"
  },
  "devDependencies": {
    "@types/node": "^22.18.1",
    "tsx": "^4.20.5",
    "typescript": "^5.9.2"
  }
}
`,
);
write(
  "apps/worker/tsconfig.json",
  `{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "noEmit": false
  },
  "include": ["src"]
}
`,
);

function nextAppFiles(appName, displayName, extraPages) {
  write(
    `apps/${appName}/package.json`,
    `{
  "name": "@finance/${appName}",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@finance/api-client": "workspace:*",
    "@finance/design-system": "workspace:*",
    "@finance/feature-flags": "workspace:*",
    "@finance/permissions": "workspace:*",
    "@tanstack/react-query": "^5.87.4",
    "next": "^15.5.3",
    "react": "^19.1.1",
    "react-dom": "^19.1.1",
    "react-hook-form": "^7.62.0",
    "zod": "^3.25.76",
    "zustand": "^5.0.8"
  },
  "devDependencies": {
    "@types/node": "^22.18.1",
    "@types/react": "^19.1.13",
    "@types/react-dom": "^19.1.9",
    "typescript": "^5.9.2"
  }
}
`,
  );
  write(
    `apps/${appName}/tsconfig.json`,
    `{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "preserve",
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "plugins": [{ "name": "next" }],
    "noEmit": true,
    "module": "ESNext",
    "moduleResolution": "Bundler"
  },
  "include": ["src", "next-env.d.ts"]
}
`,
  );
  write(
    `apps/${appName}/next.config.ts`,
    `import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: [
    "@finance/design-system",
    "@finance/api-client",
    "@finance/permissions",
    "@finance/feature-flags",
  ],
};

export default config;
`,
  );
  write(`apps/${appName}/next-env.d.ts`, `/// <reference types="next" />\n/// <reference types="next/image-types/global" />\n`);
  write(
    `apps/${appName}/src/app/layout.tsx`,
    `import type { ReactNode } from "react";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
`,
  );
  write(`apps/${appName}/src/app/page.tsx`, nextPage(displayName));
  write(`apps/${appName}/src/app/globals.css`, `* { box-sizing: border-box; }\nbody { margin: 0; font-family: ui-sans-serif, system-ui, sans-serif; }\n`);
  for (const page of extraPages) {
    const title = page.split("/").filter(Boolean).join(" / ");
    write(`apps/${appName}/src/app/${page}/page.tsx`, nextPage(title));
  }
}

nextAppFiles("web", "Company Web Portal", webPages);
nextAppFiles("vendor-portal", "Vendor Portal", vendorPortalPages);
nextAppFiles("advisor-console", "Advisor Console", advisorPages);
nextAppFiles("stack", "Stack", stackPages);

for (const feature of webFeatures) {
  for (const folder of ["api", "components", "forms", "hooks", "schemas", "types", "utils"]) {
    write(`apps/web/src/features/${feature}/${folder}/.gitkeep`, "");
  }
  write(`apps/web/src/features/${feature}/index.ts`, featureIndex(feature));
}

write("apps/web/src/design-system/index.ts", `export * from "@finance/design-system";\n`);
write("apps/web/src/components/Can.tsx", `import type { ReactNode } from "react";

type CanProps = {
  permission: string;
  children: ReactNode;
};

/** UX-only permission gate. Backend remains the final authority. */
export function Can({ children }: CanProps) {
  return <>{children}</>;
}
`);
write("apps/web/src/hooks/.gitkeep", "");
write("apps/web/src/lib/.gitkeep", "");
write("apps/web/src/stores/ui-store.ts", `/** Zustand UI state only. Do not duplicate server data here. */\nexport {};\n`);
write("apps/web/src/providers/query-provider.tsx", `/** TanStack Query provider. */\nexport {};\n`);
write("apps/web/src/config/navigation.ts", `/** Permission + entitlement + country-capability aware navigation labels. */\nexport const navigation = [];\n`);
write("apps/web/src/tests/.gitkeep", "");

const designPrimitives = ["Button", "Input", "Select", "Dialog", "Tooltip"];
const designPatterns = [
  "DataTable",
  "FilterBar",
  "PageHeader",
  "StatusBadge",
  "MoneyInput",
  "DateRangePicker",
  "ApprovalTimeline",
  "AuditTimeline",
  "DocumentViewer",
  "EmptyState",
  "DrawerReview",
];
const formFields = ["MoneyField", "UserSelect", "VendorSelect", "EntitySelect", "DateField", "AccountingDimensionSelect"];

for (const name of designPrimitives) {
  write(
    `packages/design-system/src/primitives/${name}.tsx`,
    `export function ${name}() {
  return null;
}
`,
  );
}
for (const name of designPatterns) {
  write(
    `packages/design-system/src/patterns/${name}.tsx`,
    `export function ${name}() {
  return null;
}
`,
  );
}
for (const name of formFields) {
  write(
    `packages/design-system/src/fields/${name}.tsx`,
    `export function ${name}() {
  return null;
}
`,
  );
}
write(
  "packages/design-system/src/index.ts",
  `${designPrimitives.map((n) => `export { ${n} } from "./primitives/${n}";`).join("\n")}
${designPatterns.map((n) => `export { ${n} } from "./patterns/${n}";`).join("\n")}
${formFields.map((n) => `export { ${n} } from "./fields/${n}";`).join("\n")}
`,
);
write(
  "packages/design-system/package.json",
  `{
  "name": "@finance/design-system",
  "version": "0.0.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "peerDependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  }
}
`,
);
write(
  "packages/design-system/tsconfig.json",
  `{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "jsx": "react-jsx", "lib": ["DOM", "ES2022"] },
  "include": ["src"]
}
`,
);

write(
  "packages/contracts/src/index.ts",
  `export * from "./common";
export * from "./money";
`,
);
write(
  "packages/contracts/src/common.ts",
  `import { z } from "zod";

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
    requestId: z.string().optional(),
  }),
});

export type ApiError = z.infer<typeof apiErrorSchema>;
`,
);
write(
  "packages/contracts/src/money.ts",
  `import { z } from "zod";

export const moneySchema = z.object({
  amount: z.string(),
  currency: z.string().length(3),
});

export type MoneyDto = z.infer<typeof moneySchema>;
`,
);
write(
  "packages/contracts/package.json",
  `{
  "name": "@finance/contracts",
  "version": "0.0.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "dependencies": {
    "zod": "^3.25.76"
  }
}
`,
);
write(
  "packages/contracts/tsconfig.json",
  `{
  "extends": "../../tsconfig.base.json",
  "include": ["src"]
}
`,
);

write(
  "packages/api-client/src/index.ts",
  `/** Generated API client will replace this stub. Do not hand-duplicate API types. */
export function createApiClient(_baseUrl: string) {
  return {};
}
`,
);
write(
  "packages/api-client/package.json",
  `{
  "name": "@finance/api-client",
  "version": "0.0.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "dependencies": {
    "@finance/contracts": "workspace:*"
  }
}
`,
);
write("packages/api-client/tsconfig.json", `{\n  "extends": "../../tsconfig.base.json",\n  "include": ["src"]\n}\n`);

write(
  "packages/config/src/index.ts",
  `export const appConfig = {
  appUrl: process.env.APP_URL ?? "http://localhost:3000",
  apiUrl: process.env.API_URL ?? "http://localhost:3001",
};
`,
);
write(
  "packages/config/package.json",
  `{
  "name": "@finance/config",
  "version": "0.0.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts"
}
`,
);
write("packages/config/tsconfig.json", `{\n  "extends": "../../tsconfig.base.json",\n  "include": ["src"]\n}\n`);

write(
  "packages/logger/src/index.ts",
  `export function log(fields: Record<string, unknown>) {
  console.log(JSON.stringify({ timestamp: new Date().toISOString(), ...fields }));
}
`,
);
write(
  "packages/logger/package.json",
  `{
  "name": "@finance/logger",
  "version": "0.0.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts"
}
`,
);
write("packages/logger/tsconfig.json", `{\n  "extends": "../../tsconfig.base.json",\n  "include": ["src"]\n}\n`);

write(
  "packages/money/src/index.ts",
  `export type Money = {
  amount: string;
  currency: string;
};

export function money(amount: string, currency: string): Money {
  return { amount, currency };
}
`,
);
write(
  "packages/money/package.json",
  `{
  "name": "@finance/money",
  "version": "0.0.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts"
}
`,
);
write("packages/money/tsconfig.json", `{\n  "extends": "../../tsconfig.base.json",\n  "include": ["src"]\n}\n`);

write(
  "packages/permissions/src/index.ts",
  `export const permissions = {
  expense: {
    read: "expense.read",
    create: "expense.create",
    approve: "expense.approve",
    reject: "expense.reject",
  },
  bill: {
    read: "bill.read",
    create: "bill.create",
    approve: "bill.approve",
  },
  payment: {
    create: "payment.create",
    release: "payment.release",
  },
  treasury: {
    transferCreate: "treasury.transfer.create",
    transferApprove: "treasury.transfer.approve",
    transferRelease: "treasury.transfer.release",
  },
} as const;

export const scopes = [
  "SELF",
  "ASSIGNED",
  "DIRECT_REPORTS",
  "TEAM",
  "DEPARTMENT",
  "LOCATION",
  "ENTITY",
  "MULTI_ENTITY",
  "ORGANIZATION",
  "VENDOR_SCOPED",
  "CUSTOM_SCOPE",
] as const;
`,
);
write(
  "packages/permissions/package.json",
  `{
  "name": "@finance/permissions",
  "version": "0.0.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts"
}
`,
);
write("packages/permissions/tsconfig.json", `{\n  "extends": "../../tsconfig.base.json",\n  "include": ["src"]\n}\n`);

write(
  "packages/feature-flags/src/index.ts",
  `export const featureFlags = {
  travelEmployeeRewards: process.env.FEATURE_TRAVEL_EMPLOYEE_REWARDS === "true",
  sheetsRealtimeCollab: process.env.FEATURE_SHEETS_REALTIME_COLLAB === "true",
};
`,
);
write(
  "packages/feature-flags/package.json",
  `{
  "name": "@finance/feature-flags",
  "version": "0.0.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts"
}
`,
);
write("packages/feature-flags/tsconfig.json", `{\n  "extends": "../../tsconfig.base.json",\n  "include": ["src"]\n}\n`);

// Mobile
write(
  "apps/mobile/package.json",
  `{
  "name": "@finance/mobile",
  "version": "0.0.0",
  "private": true,
  "main": "expo-router/entry",
  "scripts": {
    "dev": "expo start",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@finance/api-client": "workspace:*",
    "@finance/permissions": "workspace:*",
    "@tanstack/react-query": "^5.87.4",
    "expo": "^54.0.2",
    "expo-router": "^6.0.1",
    "expo-secure-store": "^15.0.7",
    "react": "^19.1.1",
    "react-native": "^0.81.4",
    "zod": "^3.25.76"
  },
  "devDependencies": {
    "@types/react": "^19.1.13",
    "typescript": "^5.9.2"
  }
}
`,
);
write(
  "apps/mobile/app.json",
  `{
  "expo": {
    "name": "Finance",
    "slug": "finance",
    "scheme": "financeapp",
    "orientation": "portrait"
  }
}
`,
);
write(
  "apps/mobile/tsconfig.json",
  `{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "lib": ["ES2022"],
    "noEmit": true
  },
  "include": ["app", "src", "features", "lib"]
}
`,
);
write(
  "apps/mobile/app/_layout.tsx",
  `import { Stack } from "expo-router";

export default function RootLayout() {
  return <Stack />;
}
`,
);
for (const page of mobilePages) {
  const title = page.replace(/[()]/g, "").split("/").join(" / ");
  write(
    `apps/mobile/app/${page}.tsx`,
    `import { Text, View } from "react-native";

export default function Screen() {
  return (
    <View>
      <Text>${title}</Text>
    </View>
  );
}
`,
  );
}
for (const feature of ["home", "cards", "expenses", "approvals", "reimbursements", "requests", "travel", "ai", "notifications", "settings"]) {
  write(`apps/mobile/features/${feature}/index.ts`, `/** Mobile feature: ${feature}. */\nexport {};\n`);
}
write("apps/mobile/lib/secure-storage.ts", `/** Device token storage. Never store PAN or full account numbers. */\nexport {};\n`);
write("apps/mobile/lib/offline.ts", `/** Safe offline capture only: receipts, draft reimbursement, draft memo. */\nexport {};\n`);
write("apps/mobile/tests/.gitkeep", "");

// Docs / docker / scripts
write(
  "docs/architecture/README.md",
  `# Architecture

Source of truth: \`ON_PREMISES_MODULAR_ARCHITECTURE_GUIDE.md\` at the repository root.

Product/UX source of truth: \`RAMP_VERIFIED_PRODUCT_DESIGN_V3_OPTIMIZED.md\`.
`,
);
write(
  "docs/runbooks/backup.md",
  `# Backup runbook

A backup stored on the same physical disk is not a real backup.

- Nightly \`pg_dump\` to a secondary disk / NAS
- Nightly \`rsync\` of \`/data/finance-app/uploads\`
- Verify restores periodically
`,
);
write("docs/runbooks/incident.md", `# Incident runbook\n\nDefine RPO, RTO, provider credential recovery, and escalation before production.\n`);

write(
  "docker/nginx.conf",
  `upstream api { server api:3001; }
upstream web { server web:3000; }

server {
  listen 80;
  location /api/ { proxy_pass http://api; }
  location / { proxy_pass http://web; }
}
`,
);
write(
  "docker/Dockerfile.api",
  `FROM node:22-alpine
WORKDIR /app
COPY . .
RUN corepack enable && pnpm install --frozen-lockfile && pnpm --filter @finance/api build
CMD ["node", "apps/api/dist/app/server.js"]
`,
);
write(
  "docker/Dockerfile.web",
  `FROM node:22-alpine
WORKDIR /app
COPY . .
RUN corepack enable && pnpm install --frozen-lockfile && pnpm --filter @finance/web build
CMD ["pnpm", "--filter", "@finance/web", "start"]
`,
);
write(
  "docker/Dockerfile.worker",
  `FROM node:22-alpine
WORKDIR /app
COPY . .
RUN corepack enable && pnpm install --frozen-lockfile && pnpm --filter @finance/worker build
CMD ["node", "apps/worker/dist/index.js"]
`,
);

write(
  "scripts/backup-db.sh",
  `#!/usr/bin/env bash
set -euo pipefail
# Nightly pg_dump → /data/finance-app/backups/db → secondary destination
`,
);
write(
  "scripts/backup-files.sh",
  `#!/usr/bin/env bash
set -euo pipefail
# rsync /data/finance-app/uploads → NAS / second server
`,
);
write(
  "scripts/deploy.sh",
  `#!/usr/bin/env bash
set -euo pipefail
# Install → build → migrate → restart api/worker/web → smoke test
`,
);

write(
  "docker-compose.yml",
  `services:
  web:
    build:
      context: .
      dockerfile: docker/Dockerfile.web
    depends_on:
      - api
    ports:
      - "3000:3000"
  vendor-portal:
    profiles: ["portals"]
    build:
      context: .
      dockerfile: docker/Dockerfile.web
  advisor-console:
    profiles: ["portals"]
    build:
      context: .
      dockerfile: docker/Dockerfile.web
  stack:
    profiles: ["portals"]
    build:
      context: .
      dockerfile: docker/Dockerfile.web
  api:
    build:
      context: .
      dockerfile: docker/Dockerfile.api
    depends_on:
      - postgres
      - redis
    environment:
      DATABASE_URL: postgresql://finance:finance@postgres:5432/finance
      REDIS_URL: redis://redis:6379
    ports:
      - "3001:3001"
    volumes:
      - ./data/uploads:/data/finance-app/uploads
  worker:
    build:
      context: .
      dockerfile: docker/Dockerfile.worker
    depends_on:
      - postgres
      - redis
    environment:
      DATABASE_URL: postgresql://finance:finance@postgres:5432/finance
      REDIS_URL: redis://redis:6379
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: finance
      POSTGRES_PASSWORD: finance
      POSTGRES_DB: finance
    volumes:
      - postgres-data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
  redis:
    image: redis:7
    volumes:
      - redis-data:/data
    ports:
      - "6379:6379"

volumes:
  postgres-data:
  redis-data:
`,
);

write(
  ".env.example",
  `NODE_ENV=development

DATABASE_URL=postgresql://finance:finance@localhost:5432/finance
REDIS_URL=redis://localhost:6379

STORAGE_DRIVER=local
STORAGE_PATH=/data/finance-app/uploads

OPENAI_API_KEY=

JWT_SECRET=change-me
ENCRYPTION_KEY=change-me

APP_URL=http://localhost:3000
API_URL=http://localhost:3001
MOBILE_DEEP_LINK_SCHEME=financeapp

FEATURE_TRAVEL_EMPLOYEE_REWARDS=false
FEATURE_SHEETS_REALTIME_COLLAB=false
`,
);

write(
  "pnpm-workspace.yaml",
  `packages:
  - "apps/*"
  - "packages/*"
`,
);

write(
  "package.json",
  `{
  "name": "finance-platform",
  "private": true,
  "packageManager": "pnpm@9.15.9",
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "typecheck": "turbo typecheck",
    "test": "turbo test",
    "dev:api": "pnpm --filter @finance/api dev",
    "dev:web": "pnpm --filter @finance/web dev",
    "dev:worker": "pnpm --filter @finance/worker dev"
  },
  "devDependencies": {
    "turbo": "^2.5.6",
    "typescript": "^5.9.2"
  }
}
`,
);

write(
  "turbo.json",
  `{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "typecheck": {
      "dependsOn": ["^typecheck"]
    },
    "test": {
      "dependsOn": ["^build"]
    }
  }
}
`,
);

write(
  "tsconfig.base.json",
  `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "resolveJsonModule": true,
    "isolatedModules": true
  }
}
`,
);

write(
  ".gitignore",
  `node_modules
dist
.next
.expo
.env
*.log
coverage
data/uploads
`,
);

write(
  "README.md",
  `# Finance Platform

On-premises modular monolith for the AI-powered financial operations SaaS.

- Architecture: \`ON_PREMISES_MODULAR_ARCHITECTURE_GUIDE.md\`
- Product design: \`RAMP_VERIFIED_PRODUCT_DESIGN_V3_OPTIMIZED.md\`

This repository currently contains the **Phase 1 folder scaffold**. Domain logic is not implemented yet.

## Apps

- \`apps/api\` — Express modular monolith
- \`apps/worker\` — BullMQ workers
- \`apps/web\` — Company web portal
- \`apps/mobile\` — Employee/approver mobile app
- \`apps/vendor-portal\`
- \`apps/advisor-console\`
- \`apps/stack\`

## Packages

- \`packages/contracts\` — Zod + OpenAPI source
- \`packages/api-client\` — generated API client (stub)
- \`packages/design-system\`
- \`packages/permissions\`
- \`packages/money\`
- \`packages/feature-flags\`
- \`packages/config\`
- \`packages/logger\`

## Start

\`\`\`bash
pnpm install
pnpm dev:api
pnpm dev:web
\`\`\`
`,
);

console.log("Scaffold written under", root);
