import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const sdk = vi.hoisted(() => ({ capture: vi.fn(), update: vi.fn(), retrieve: vi.fn() }));
vi.mock("stripe", () => ({ default: class { testHelpers = { issuing: { transactions: { createForceCapture: sdk.capture } } }; issuing = { transactions: { update: sdk.update, retrieve: sdk.retrieve } }; } }));
import { StripePaymentRailAdapter } from "../integrations/payment-rail/stripe.payment-rail.adapter";
describe("Stripe payment verification and replay", () => {
  const payment = { paymentId: "pay_regression", amount: "10.00", currency: "USD", rail: "ACH" as const };
  const transaction = { id: "ipi_regression", type: "capture", amount: -1000, currency: "usd", card: "ic_regression", metadata: { app_payment_id: payment.paymentId } };
  beforeEach(() => { vi.stubEnv("STRIPE_BILL_PAY_CARD_ID", "ic_regression"); vi.clearAllMocks(); sdk.capture.mockResolvedValue(transaction); sdk.update.mockResolvedValue(transaction); sdk.retrieve.mockResolvedValue(transaction); });
  afterEach(() => vi.unstubAllEnvs());
  it("reuses the provider idempotency key across payment release retries", async () => {
    const rail = new StripePaymentRailAdapter("sk_test_regression");
    expect(await rail.release(payment)).toMatchObject({ status: "ACCEPTED", providerRef: transaction.id });
    await rail.release(payment);
    expect(sdk.capture.mock.calls.map(call => call[1])).toEqual([{ idempotencyKey: "bill-pay:pay_regression" }, { idempotencyKey: "bill-pay:pay_regression" }]);
    expect(sdk.update).toHaveBeenCalledWith(transaction.id, { metadata: { app_payment_id: payment.paymentId } }, { idempotencyKey: "bill-pay-tag:pay_regression" });
  });
  it("rejects invented settlement references before calling Stripe", async () => {
    const rail = new StripePaymentRailAdapter("sk_test_regression");
    expect(await rail.settle({ ...payment, providerRef: "mock_forged" })).toMatchObject({ status: "FAILED" });
    expect(await rail.settle({ providerRef: transaction.id })).toMatchObject({ status: "FAILED" });
    expect(sdk.retrieve).not.toHaveBeenCalled();
  });
  it.each([{ amount: -999 }, { amount: 1000 }, { type: "refund" }, { card: "ic_other" }, { currency: "eur" }, { metadata: { app_payment_id: "pay_other" } }])("rejects mismatched provider transaction %j", async mismatch => {
    sdk.retrieve.mockResolvedValue({ ...transaction, ...mismatch });
    expect(await new StripePaymentRailAdapter("sk_test_regression").settle({ ...payment, providerRef: transaction.id })).toMatchObject({ status: "FAILED" });
  });
  it("settles a verified debit belonging to the expected payment", async () => {
    expect(await new StripePaymentRailAdapter("sk_test_regression").settle({ ...payment, providerRef: transaction.id })).toMatchObject({ status: "COMPLETED", settlementId: "stripe_settle_ipi_regression" });
  });
});
