import { prisma } from "../../database/client";
import type { RequestContext } from "../../platform/auth/context";
import { scopedWhere } from "../../platform/resource-access";
import { AppError } from "../../platform/http";

export type SearchHit = {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  status?: string;
  href: string;
};

export async function searchOrganization(ctx: RequestContext, q: string) {
  const query = q.trim();
  if (!query) {
    return { query: "", total: 0, groups: [] as SearchHit[], vendors: [], people: [], bills: [], transactions: [], expenses: [], purchaseOrders: [], trips: [], spendRequests: [] };
  }
  if (query.length > 120) throw new AppError("INVALID_QUERY", "Search is too long", 400);

  async function scope(resource: string) {
    try { return await scopedWhere(ctx, resource); }
    catch (error) { if (error instanceof AppError && error.status === 403) return null; throw error; }
  }

  const [vendorScope, peopleScope, billScope, transactionScope, expenseScope, poScope, travelScope, requestScope] = await Promise.all([
    scope("vendors"), scope("people"), scope("bills"), scope("transactions"),
    scope("expenses"), scope("purchase-orders"), scope("travel"), scope("spend-requests"),
  ]);

  const [vendors, people, bills, transactions, expenses, purchaseOrders, trips, spendRequests] = await Promise.all([
    vendorScope ? prisma.vendor.findMany({ where: { AND: [vendorScope, { name: { contains: query, mode: "insensitive" } }] }, select: { id: true, name: true, category: true, status: true }, take: 8 }) : [],
    peopleScope ? prisma.user.findMany({
      where: { AND: [peopleScope, { OR: [
        { email: { contains: query, mode: "insensitive" } },
        { firstName: { contains: query, mode: "insensitive" } },
        { lastName: { contains: query, mode: "insensitive" } },
      ] }] },
      select: { id: true, email: true, firstName: true, lastName: true, status: true }, take: 8,
    }) : [],
    billScope ? prisma.bill.findMany({ where: { AND: [billScope, { invoiceNumber: { contains: query, mode: "insensitive" } }] }, select: { id: true, invoiceNumber: true, amount: true, currency: true, status: true }, take: 8 }) : [],
    transactionScope ? prisma.txn.findMany({ where: { AND: [transactionScope, { merchant: { contains: query, mode: "insensitive" } }] }, select: { id: true, merchant: true, amount: true, currency: true, status: true }, take: 8 }) : [],
    expenseScope ? prisma.expense.findMany({ where: { AND: [expenseScope, { OR: [{ merchant: { contains: query, mode: "insensitive" } }, { memo: { contains: query, mode: "insensitive" } }] }] }, select: { id: true, merchant: true, amount: true, currency: true, status: true }, take: 8 }) : [],
    poScope ? prisma.purchaseOrder.findMany({ where: { AND: [poScope, { number: { contains: query, mode: "insensitive" } }] }, select: { id: true, number: true, amount: true, currency: true, status: true }, take: 8 }) : [],
    travelScope ? prisma.travelTrip.findMany({ where: { AND: [travelScope, { OR: [{ name: { contains: query, mode: "insensitive" } }, { destination: { contains: query, mode: "insensitive" } }] }] }, select: { id: true, name: true, destination: true, status: true }, take: 8 }) : [],
    requestScope ? prisma.spendRequest.findMany({ where: { AND: [requestScope, { name: { contains: query, mode: "insensitive" } }] }, select: { id: true, name: true, amount: true, currency: true, status: true }, take: 8 }) : [],
  ]);

  const results: SearchHit[] = [
    ...vendors.map((item) => ({ id: item.id, type: "vendor", title: item.name, subtitle: item.category || "Vendor", status: item.status, href: `/app/vendors` })),
    ...people.map((item) => ({ id: item.id, type: "person", title: `${item.firstName} ${item.lastName}`.trim(), subtitle: item.email, status: item.status, href: `/app/company/people` })),
    ...bills.map((item) => ({ id: item.id, type: "bill", title: item.invoiceNumber, subtitle: `${item.currency} ${item.amount}`, status: item.status, href: `/app/bill-pay/bills` })),
    ...transactions.map((item) => ({ id: item.id, type: "transaction", title: item.merchant, subtitle: `${item.currency} ${item.amount}`, status: item.status, href: `/app/spend/transactions` })),
    ...expenses.map((item) => ({ id: item.id, type: "expense", title: item.merchant, subtitle: `${item.currency} ${item.amount}`, status: item.status, href: `/app/expenses/transactions` })),
    ...purchaseOrders.map((item) => ({ id: item.id, type: "purchase_order", title: item.number, subtitle: `${item.currency} ${item.amount}`, status: item.status, href: `/app/procurement/purchase-orders/${item.id}` })),
    ...trips.map((item) => ({ id: item.id, type: "travel", title: item.name, subtitle: item.destination, status: item.status, href: `/app/travel/trips/${item.id}` })),
    ...spendRequests.map((item) => ({ id: item.id, type: "spend_request", title: item.name, subtitle: `${item.currency} ${item.amount}`, status: item.status, href: `/app/spend/requests` })),
  ];

  return {
    query,
    total: results.length,
    results,
    vendors, people, bills, transactions, expenses, purchaseOrders, trips, spendRequests,
  };
}
