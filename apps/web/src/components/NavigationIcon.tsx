// Shared outline icons keep the sidebar consistent without changing its routes.
const paths = {
  home: "m3 10 9-7 9 7M5 9v12h5v-7h4v7h5V9",
  inbox: "M4 4h16v16H4zM4 13h5l2 3h2l2-3h5",
  search: "M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  card: "M3 5h18v14H3zM3 9h18M6 15h3m3 0h2",
  receipt: "M6 3h9l3 3v15l-3-2-3 2-3-2-3 2zM14 3v5h4M9 11h6m-6 4h4",
  list: "M9 6h12M9 12h12M9 18h8M3 5h2v2H3zM3 11h2v2H3zM3 17h2v2H3z",
  gift: "M3 8h18v4H3zM5 12v9h14v-9M12 8v13M12 8H8a3 3 0 1 1 3-4l1 4Zm0 0h4a3 3 0 1 0-3-4l-1 4Z",
  plane: "m22 2-6 20-4-8-8-4 18-8ZM12 14l10-12M4 16l-2 6 6-2",
  grid: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
  file: "M6 3h9l4 4v14H6zM14 3v5h5M9 12h7m-7 4h7",
  coins: "M4 6c0-4 16-4 16 0s-16 4-16 0Zm0 0v12c0 4 16 4 16 0V6M4 10c0 4 16 4 16 0M4 14c0 4 16 4 16 0",
  transfer: "M3 7h17m-4-4 4 4-4 4M21 17H4m4-4-4 4 4 4",
  check: "M9 3h6v4H9zM9 5H5v16h14V5h-4M8 14l3 3 5-6",
  plus: "M4 3h16v18H4zM12 7v10M7 12h10",
  clock: "M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0M12 6v6l4 2",
  alert: "m12 3 10 18H2L12 3ZM12 9v5m0 3v.5",
  package: "m12 2 9 5v10l-9 5-9-5V7l9-5ZM3 7l9 5 9-5M12 12v10M7 4.5l9 5",
  building: "M4 21V7l8-4 8 4v14M2 21h20M8 9h1m6 0h1M8 13h1m6 0h1M10 21v-5h4v5",
  wallet: "M3 7V5l15-3v5M3 7h18v14H3zM21 12h-6v5h6m-3-2.5h.1",
  book: "M12 5C8 2 4 3 2 4v16c4-2 7-1 10 1 3-2 6-3 10-1V4c-4-2-7-1-10 1Zm0 0v16",
  sync: "M20 7a9 9 0 0 0-15-2L2 8m0-6v6h6M4 17a9 9 0 0 0 15 2l3-3m0 6v-6h-6",
  sliders: "M4 3v4m0 4v10M12 3v10m0 4v4M20 3v2m0 4v12M1 7h6v4H1zM9 13h6v4H9zM17 5h6v4h-6z",
  plug: "M8 2v5m8-5v5M5 7h14v4a7 7 0 0 1-14 0V7ZM12 18v4",
  chart: "M4 3v18h18M8 17v-5m5 5V7m5 10V4",
  target: "M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0M18 12a6 6 0 1 1-12 0 6 6 0 0 1 12 0M14 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0",
  bell: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4",
  settings: "m9 3-1 3-3 1-2 3 2 2v2l-2 2 2 3 3 1 1 3h6l1-3 3-1 2-3-2-2v-2l2-2-2-3-3-1-1-3H9ZM16 13a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  users: "M10 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M2 21v-4a4 4 0 0 1 4-4h2a4 4 0 0 1 4 4v4M16 3a4 4 0 0 1 0 8m0 2h2a4 4 0 0 1 4 4v4",
  pin: "M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0ZM15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  shield: "m12 2 9 4v6c0 6-9 10-9 10S3 18 3 12V6l9-4ZM8 12l3 3 5-6",
  code: "m8 6-6 6 6 6m8-12 6 6-6 6M14 3l-4 18",
  sparkles: "m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3ZM20 2v4m-2-2h4",
  robot: "M4 7h16v14H4zM12 3v4M1 11v6m22-6v6M8 12h.1m7.9 0h.1M8 17h8",
} satisfies Record<string, string>;

type IconName = keyof typeof paths;

const iconGroups: Partial<Record<IconName, readonly string[]>> = {
  home: ["Overview"],
  inbox: ["Inbox"],
  search: ["Search"],
  card: ["My card", "Cards"],
  receipt: ["My expenses", "Receipts", "Bills", "Invoices"],
  list: ["My requests", "Requests", "Trip requests", "Router logs", "Audit log"],
  gift: ["My reimbursements", "Reimbursements", "Rewards"],
  plane: ["My travel", "Trips"],
  grid: ["Spend programs", "Programs", "Departments", "Accounting dimensions", "Sheets"],
  file: ["Spend requests", "Purchase Orders", "Contracts", "Tax operations"],
  coins: ["Funds", "Token spend"],
  transfer: ["Transactions", "Payments", "Transfers", "Incoming payments"],
  check: ["Expense review", "For approval", "For payout", "For payment", "Ready to sync", "Approval rules"],
  clock: ["Paid / History", "History"],
  alert: ["Failures", "Match Exceptions", "Sync errors", "Needs review", "Disputes"],
  package: ["Receiving"],
  building: ["Vendors", "Entities"],
  wallet: ["Payment runs", "Accounts"],
  sync: ["Synced"],
  sliders: ["Rules"],
  plug: ["Integrations"],
  chart: ["Dashboard", "Reports"],
  target: ["Budgets"],
  bell: ["Notifications"],
  settings: ["Settings"],
  users: ["People", "Customers"],
  pin: ["Locations"],
  shield: ["Roles", "Policies"],
  code: ["Developer apps"],
  sparkles: ["Ask AI"],
  robot: ["Agent identities"],
};

export function NavigationIcon({ label }: { label: string }) {
  const name = (Object.keys(iconGroups) as IconName[]).find((icon) => iconGroups[icon]?.includes(label)) ?? "file";
  return (
    <svg className="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={paths[name]} />
    </svg>
  );
}
