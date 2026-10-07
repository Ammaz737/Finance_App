import type { TravelProvider } from "./travel.provider";
import { DuffelTravelAdapter } from "./duffel.travel.adapter";
import { MockTravelAdapter } from "./mock.travel.adapter";

let cached: TravelProvider | null = null;
let cachedKey = "";

function providerKey(): string {
  const name = (process.env.TRAVEL_PROVIDER ?? "mock").trim().toLowerCase();
  const token = (process.env.DUFFEL_ACCESS_TOKEN ?? "").trim();
  const version = (process.env.DUFFEL_API_VERSION ?? "v2").trim() || "v2";
  return `${name}|${token.slice(0, 16)}|${version}`;
}

export function getTravelProvider(): TravelProvider {
  const key = providerKey();
  if (cached && cachedKey === key) return cached;

  const name = (process.env.TRAVEL_PROVIDER ?? "mock").trim().toLowerCase();
  if (name === "duffel") {
    const token = (process.env.DUFFEL_ACCESS_TOKEN ?? "").trim();
    if (!token) {
      throw new Error("DUFFEL_ACCESS_TOKEN is required when TRAVEL_PROVIDER=duffel");
    }
    cached = new DuffelTravelAdapter(token, (process.env.DUFFEL_API_VERSION ?? "v2").trim() || "v2");
  } else {
    cached = new MockTravelAdapter();
  }
  cachedKey = key;
  return cached;
}

/** Test-only: reset singleton between cases. */
export function resetTravelProviderForTests(): void {
  cached = null;
  cachedKey = "";
}

export function isDuffelTravelProvider(): boolean {
  return getTravelProvider().name === "duffel";
}

export function getTravelCapabilities() {
  const provider = getTravelProvider().name;
  return {
    provider,
    searchTypes: provider === "mock" ? ["FLIGHT", "HOTEL", "CAR"] : [
      "FLIGHT",
      ...(process.env.DUFFEL_ENABLE_STAYS === "true" ? ["HOTEL"] : []),
      ...(process.env.DUFFEL_ENABLE_CARS === "true" ? ["CAR"] : []),
    ],
    // Duffel search is live; hold/confirm/cancel/refund stay sandbox (mock) for the demo playbook.
    booking: true,
    sandbox: true,
    message: provider === "duffel"
      ? "Live Duffel flight search. Place mock hold / Confirm / Cancel / Refund are sandbox-only (no live tickets). Hotels/cars need provider access."
      : "Sandbox bookings only; no tickets or provider payments are created.",
  };
}
