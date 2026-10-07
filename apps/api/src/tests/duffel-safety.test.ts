import { afterEach, describe, expect, it, vi } from "vitest";
import { DuffelTravelAdapter } from "../integrations/travel/duffel.travel.adapter";
describe("Duffel capability safety", () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  it.each(["HOTEL", "CAR"] as const)("rejects unavailable %s before making an external request", async type => {
    vi.stubEnv("DUFFEL_ENABLE_STAYS", "false"); vi.stubEnv("DUFFEL_ENABLE_CARS", "false");
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    await expect(new DuffelTravelAdapter("duffel_test_regression").search({ type, destination: "New York", startDate: "2027-01-01", endDate: "2027-01-03", currency: "USD" })).rejects.toMatchObject({ code: "TRAVEL_FEATURE_UNAVAILABLE" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("does not fabricate bookings, cancellations or refunds", async () => {
    const adapter = new DuffelTravelAdapter("duffel_test_regression");
    for (const operation of [adapter.hold({ tripId: "trip", quoteId: "offer", amount: "10", currency: "USD" }), adapter.confirm({ providerRef: "fake" }), adapter.cancel({ providerRef: "fake" }), adapter.refund({ providerRef: "fake" })]) await expect(operation).rejects.toMatchObject({ code: "TRAVEL_BOOKING_UNAVAILABLE" });
  });
  it("reprices against the provider offer rather than a simulated price", async () => {
    const expires = new Date(Date.now() + 60000).toISOString();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => JSON.stringify({ data: { total_amount: "123.45", total_currency: "usd", expires_at: expires } }) });
    vi.stubGlobal("fetch", fetchMock);
    const adapter = new DuffelTravelAdapter("duffel_test_regression");
    expect(await adapter.reprice({ quoteId: "off_regression", quotedAmount: "100.00", currency: "USD" })).toMatchObject({ amount: "123.45", currency: "USD", changed: true, offerExpiry: expires });
    expect(fetchMock).toHaveBeenCalledWith("https://api.duffel.com/air/offers/off_regression", expect.objectContaining({ method: "GET" }));
    await expect(adapter.reprice({ quoteId: "off_regression", quotedAmount: "100.00", currency: "USD", forceHigh: true })).rejects.toMatchObject({ code: "TEST_ONLY" });
  });
});
