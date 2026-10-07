import { AppError } from "../../platform/http";
import { MockTravelAdapter } from "./mock.travel.adapter";
import type {
  TravelCancelInput,
  TravelCancelResult,
  TravelConfirmInput,
  TravelConfirmResult,
  TravelHoldInput,
  TravelHoldResult,
  TravelProvider,
  TravelQuote,
  TravelRefundInput,
  TravelRefundResult,
  TravelRepriceInput,
  TravelRepriceResult,
  TravelSearchInput,
} from "./travel.provider";

type Json = Record<string, unknown>;

type ResolvedPlace = {
  label: string;
  iata?: string;
  latitude?: number;
  longitude?: number;
};

const CITY_FALLBACKS: Record<string, ResolvedPlace> = {
  nyc: { label: "New York", iata: "JFK", latitude: 40.6413, longitude: -73.7781 },
  "new york": { label: "New York", iata: "JFK", latitude: 40.6413, longitude: -73.7781 },
  austin: { label: "Austin", iata: "AUS", latitude: 30.1975, longitude: -97.6664 },
  sfo: { label: "San Francisco", iata: "SFO", latitude: 37.6213, longitude: -122.379 },
  "san francisco": { label: "San Francisco", iata: "SFO", latitude: 37.6213, longitude: -122.379 },
  lax: { label: "Los Angeles", iata: "LAX", latitude: 33.9425, longitude: -118.408 },
  "los angeles": { label: "Los Angeles", iata: "LAX", latitude: 33.9425, longitude: -118.408 },
  lon: { label: "London", iata: "LHR", latitude: 51.47, longitude: -0.4543 },
  london: { label: "London", iata: "LHR", latitude: 51.47, longitude: -0.4543 },
  lhr: { label: "London Heathrow", iata: "LHR", latitude: 51.47, longitude: -0.4543 },
  jfk: { label: "New York JFK", iata: "JFK", latitude: 40.6413, longitude: -73.7781 },
  aus: { label: "Austin", iata: "AUS", latitude: 30.1975, longitude: -97.6664 },
  chi: { label: "Chicago", iata: "ORD", latitude: 41.9742, longitude: -87.9073 },
  chicago: { label: "Chicago", iata: "ORD", latitude: 41.9742, longitude: -87.9073 },
  bos: { label: "Boston", iata: "BOS", latitude: 42.3656, longitude: -71.0096 },
  boston: { label: "Boston", iata: "BOS", latitude: 42.3656, longitude: -71.0096 },
};

function ymd(iso: string): string {
  const raw = String(iso ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    throw new AppError("INVALID_DATE", `Invalid travel date: ${raw || "(empty)"}`, 400);
  }
  return d.toISOString().slice(0, 10);
}

function hm(iso: string, fallback = "10:00"): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return fallback;
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

function money2(value: string | number | undefined | null, fallback = "0.00"): string {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(2) : fallback;
}

function cabinClass(cabin?: string): string {
  const raw = (cabin ?? "economy").toLowerCase().replace(/\s+/g, "_");
  if (["economy", "premium_economy", "business", "first"].includes(raw)) return raw;
  if (raw === "premium") return "premium_economy";
  return "economy";
}

/**
 * Live Duffel search adapter.
 * Hold/confirm/cancel/refund run through the sandbox mock path for the demo playbook.
 */
export class DuffelTravelAdapter implements TravelProvider {
  readonly name = "duffel" as const;
  /** Demo playbook uses sandbox mock holds; live Duffel orders are not wired. */
  private readonly sandbox = new MockTravelAdapter();

  constructor(
    private readonly accessToken: string,
    private readonly apiVersion = "v2",
  ) {
    if (!accessToken.trim()) {
      throw new Error("DUFFEL_ACCESS_TOKEN is required for DuffelTravelAdapter");
    }
  }

  private async api<T = Json>(
    method: "GET" | "POST",
    path: string,
    body?: unknown,
  ): Promise<T> {
    const response = await fetch(`https://api.duffel.com${path}`, {
      method,
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip",
        "Content-Type": "application/json",
        "Duffel-Version": this.apiVersion,
        Authorization: `Bearer ${this.accessToken}`,
      },
      body: body != null ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(45_000),
    });

    const rawText = await response.text();
    let json: { data?: T; errors?: Array<{ title?: string; message?: string; code?: string }> } = {};
    if (rawText) {
      try {
        json = JSON.parse(rawText) as typeof json;
      } catch {
        if (!response.ok) {
          throw new AppError(
            "DUFFEL_ERROR",
            rawText.trim() || `Duffel ${method} ${path} failed (${response.status})`,
            response.status >= 500 ? 502 : response.status,
            { status: response.status, path, raw: rawText.slice(0, 300) },
          );
        }
        throw new AppError("DUFFEL_ERROR", `Duffel returned non-JSON for ${path}`, 502, {
          status: response.status,
          path,
        });
      }
    }

    if (!response.ok) {
      const first = json.errors?.[0];
      const message =
        first?.message
        || first?.title
        || rawText.trim()
        || `Duffel ${method} ${path} failed (${response.status})`;
      const status =
        response.status >= 500 ? 502
          : response.status === 401 || response.status === 403 || response.status === 404 ? response.status
            : 400;
      throw new AppError("DUFFEL_ERROR", message, status, {
        code: first?.code,
        status: response.status,
        path,
      });
    }
    return (json.data ?? json) as T;
  }

  private async resolvePlace(query: string): Promise<ResolvedPlace> {
    const key = query.trim().toLowerCase();
    if (!key) throw new AppError("INVALID_PLACE", "Origin/destination is required for Duffel search", 400);
    if (/^[a-z]{3}$/i.test(key)) {
      const hit = CITY_FALLBACKS[key];
      return hit ?? { label: key.toUpperCase(), iata: key.toUpperCase() };
    }
    if (CITY_FALLBACKS[key]) return CITY_FALLBACKS[key];

    try {
      const suggestions = await this.api<Array<Json>>(
        "GET",
        `/places/suggestions?query=${encodeURIComponent(query.trim())}`,
      );
      const list = Array.isArray(suggestions) ? suggestions : [];
      const airport = list.find((row) => String(row.type ?? "") === "airport" && row.iata_code)
        ?? list.find((row) => row.iata_code)
        ?? list[0];
      if (airport) {
        const coords = (airport.geographic_coordinates ?? airport) as Json;
        return {
          label: String(airport.name ?? airport.city_name ?? query),
          iata: airport.iata_code ? String(airport.iata_code) : undefined,
          latitude: coords.latitude != null ? Number(coords.latitude) : undefined,
          longitude: coords.longitude != null ? Number(coords.longitude) : undefined,
        };
      }
    } catch {
      // Fall through to fuzzy city map / error.
    }

    const fuzzy = Object.entries(CITY_FALLBACKS).find(([name]) => key.includes(name) || name.includes(key));
    if (fuzzy) return fuzzy[1];
    throw new AppError(
      "PLACE_UNRESOLVED",
      `Could not resolve "${query}" to an airport/city for Duffel. Use IATA codes (e.g. AUS, JFK) or common city names.`,
      400,
    );
  }

  private policyFlags(amount: string, maxAmount?: number): Pick<TravelQuote, "outOfPolicy" | "policyResult"> {
    const n = Number(amount);
    if (maxAmount != null && Number.isFinite(maxAmount) && n > maxAmount) {
      return { outOfPolicy: true, policyResult: "REVIEW" };
    }
    return { outOfPolicy: false, policyResult: "PASS" };
  }

  async search(input: TravelSearchInput): Promise<TravelQuote[]> {
    if ((input.type === "HOTEL" && process.env.DUFFEL_ENABLE_STAYS !== "true")
      || (input.type === "CAR" && process.env.DUFFEL_ENABLE_CARS !== "true")) {
      throw new AppError("TRAVEL_FEATURE_UNAVAILABLE", `${input.type} search is not enabled for this provider account`, 409);
    }
    if (input.type === "FLIGHT") return this.searchFlights(input);
    if (input.type === "HOTEL") return this.searchHotels(input);
    return this.searchCars(input);
  }

  private async searchFlights(input: TravelSearchInput): Promise<TravelQuote[]> {
    const destination = await this.resolvePlace(input.destination);
    const origin = await this.resolvePlace(input.origin || "AUS");
    if (!destination.iata || !origin.iata) {
      throw new AppError("PLACE_UNRESOLVED", "Flight search needs airport IATA codes for origin and destination", 400);
    }

    const data = await this.api<Json>("POST", "/air/offer_requests?return_offers=true", {
      data: {
        slices: [
          {
            origin: origin.iata,
            destination: destination.iata,
            departure_date: ymd(input.startDate),
          },
        ],
        passengers: [{ type: "adult" }],
        cabin_class: cabinClass(input.cabin),
      },
    });

    const offers = Array.isArray(data.offers) ? (data.offers as Json[]) : [];
    return offers.slice(0, 12).map((offer, index) => {
      const amount = money2(offer.total_amount as string);
      const currency = String(offer.total_currency ?? input.currency).toUpperCase();
      const owner = (offer.owner ?? {}) as Json;
      const slices = Array.isArray(offer.slices) ? (offer.slices as Json[]) : [];
      const firstSlice = slices[0] ?? {};
      const segments = Array.isArray(firstSlice.segments) ? (firstSlice.segments as Json[]) : [];
      const firstSeg = segments[0] ?? {};
      const marketing = (firstSeg.marketing_carrier ?? owner) as Json;
      const supplier = String(owner.name ?? marketing.name ?? "Airline");
      const policy = this.policyFlags(amount, input.maxAmount);
      const offerId = String(offer.id ?? `duffel_flight_${index}`);
      const expires = String(offer.expires_at ?? new Date(Date.now() + 20 * 60 * 1000).toISOString());
      const logo = String(owner.logo_lockup_url ?? owner.logo_symbol_url ?? "");
      return {
        quoteId: offerId,
        provider: "duffel",
        providerOfferId: offerId,
        type: "FLIGHT" as const,
        supplier,
        description: `${origin.iata} → ${destination.iata} · ${segments.length || 1} segment(s)`,
        amount,
        currency,
        refundable: Boolean((offer.conditions as Json | undefined)?.refund_before_departure),
        cancellationTerms: (offer.conditions as Json | undefined)?.refund_before_departure
          ? "Refundable before departure (airline conditions apply)"
          : "See airline fare rules",
        offerExpiry: expires,
        ...policy,
        itinerary: {
          origin: origin.iata,
          destination: destination.iata,
          slices,
          passengers: data.passengers,
          liveMode: offer.live_mode === true,
        },
        startsAt: String(firstSeg.departing_at ?? input.startDate),
        endsAt: String((segments[segments.length - 1] as Json | undefined)?.arriving_at ?? input.endDate),
        metadata: {
          imageUrl: logo || undefined,
          cabinClass: cabinClass(input.cabin),
          duffelOfferRequestId: data.id,
          rawOfferId: offerId,
        },
      };
    });
  }

  private async searchHotels(input: TravelSearchInput): Promise<TravelQuote[]> {
    const place = await this.resolvePlace(input.destination);
    if (place.latitude == null || place.longitude == null) {
      throw new AppError(
        "PLACE_UNRESOLVED",
        `Hotel search needs coordinates for "${input.destination}". Try a major city name or nearby airport code.`,
        400,
      );
    }

    // Guide: POST /stays/search → data.results
    const payload = await this.api<Json>("POST", "/stays/search", {
      data: {
        check_in_date: ymd(input.startDate),
        check_out_date: ymd(input.endDate),
        rooms: 1,
        guests: [{ type: "adult" }, { type: "adult" }],
        location: {
          radius: 5,
          geographic_coordinates: {
            latitude: place.latitude,
            longitude: place.longitude,
          },
        },
      },
    });

    const list = Array.isArray(payload.results) ? (payload.results as Json[]) : [];
    if (!list.length) {
      throw new AppError(
        "DUFFEL_STAYS_EMPTY",
        `No hotel results near ${place.label}. Try another city or date range.`,
        404,
      );
    }

    return list.slice(0, 12).map((row, index) => {
      const accommodation = (row.accommodation ?? {}) as Json;
      const amount = money2(
        (row.cheapest_rate_total_amount as string)
          ?? (row.cheapest_rate_public_amount as string)
          ?? (accommodation.total_amount as string),
      );
      const currency = String(
        row.cheapest_rate_currency
          ?? row.cheapest_rate_public_currency
          ?? input.currency,
      ).toUpperCase();
      const photos = Array.isArray(accommodation.photos) ? (accommodation.photos as Json[]) : [];
      const imageUrl = String(photos[0]?.url ?? "");
      const supplier = String(accommodation.name ?? "Hotel");
      const policy = this.policyFlags(amount, input.maxAmount);
      const resultId = String(row.id ?? `duffel_stay_${index}`);
      const expires = String(row.expires_at ?? new Date(Date.now() + 20 * 60 * 1000).toISOString());
      return {
        quoteId: resultId,
        provider: "duffel",
        providerOfferId: resultId,
        type: "HOTEL" as const,
        supplier,
        description: `${supplier} · ${place.label}`,
        amount,
        currency,
        refundable: Boolean(row.cheapest_rate_free_cancellation),
        cancellationTerms: row.cheapest_rate_free_cancellation
          ? "Free cancellation (rate rules apply)"
          : "See hotel rate rules",
        offerExpiry: expires,
        ...policy,
        itinerary: {
          destination: place.label,
          checkIn: ymd(input.startDate),
          checkOut: ymd(input.endDate),
          accommodation,
          location: { latitude: place.latitude, longitude: place.longitude },
        },
        startsAt: input.startDate,
        endsAt: input.endDate,
        metadata: {
          imageUrl: imageUrl || undefined,
          rating: accommodation.rating,
          duffelSearchResultId: resultId,
        },
      };
    });
  }

  private async searchCars(input: TravelSearchInput): Promise<TravelQuote[]> {
    const place = await this.resolvePlace(input.destination);
    if (place.latitude == null || place.longitude == null) {
      throw new AppError(
        "PLACE_UNRESOLVED",
        `Car search needs coordinates for "${input.destination}". Try a major city name or airport code.`,
        400,
      );
    }

    const loc = {
      radius: 5,
      geographic_coordinates: {
        latitude: place.latitude,
        longitude: place.longitude,
      },
    };

    // Guide: POST /cars/search → data.rates
    const data = await this.api<Json>("POST", "/cars/search", {
      data: {
        pickup_date: ymd(input.startDate),
        pickup_time: hm(input.startDate, "10:30"),
        dropoff_date: ymd(input.endDate),
        dropoff_time: hm(input.endDate, "15:00"),
        pickup_location: loc,
        dropoff_location: loc,
        driver: { age: 30, residence_country_code: "PK" },
      },
    });

    const results = Array.isArray(data.rates) ? (data.rates as Json[]) : [];
    if (!results.length) {
      throw new AppError(
        "DUFFEL_CARS_EMPTY",
        `No car rental results near ${place.label}. Try another city or date range.`,
        404,
      );
    }

    return results.slice(0, 12).map((row, index) => {
      const car = (row.car ?? row) as Json;
      const supplierObj = (row.supplier ?? row.provider ?? {}) as Json;
      const amount = money2((row.total_amount as string) ?? (row.base_amount as string));
      const currency = String(row.total_currency ?? row.base_currency ?? input.currency).toUpperCase();
      const images = Array.isArray(car.images) ? (car.images as Json[]) : [];
      const imageUrl = String(images[0]?.url ?? supplierObj.logo_url ?? "");
      const supplier = String(supplierObj.name ?? car.name ?? "Car rental");
      const policy = this.policyFlags(amount, input.maxAmount);
      const offerId = String(row.id ?? `duffel_car_${index}`);
      return {
        quoteId: offerId,
        provider: "duffel",
        providerOfferId: offerId,
        type: "CAR" as const,
        supplier,
        description: `${String(car.name ?? "Vehicle")} · ${String(car.category ?? "car")} · ${place.label}`,
        amount,
        currency,
        refundable: false,
        cancellationTerms: "See rental rate rules",
        offerExpiry: String(row.expires_at ?? new Date(Date.now() + 20 * 60 * 1000).toISOString()),
        ...policy,
        itinerary: {
          destination: place.label,
          car,
          pickup: loc,
          dropoff: loc,
        },
        startsAt: input.startDate,
        endsAt: input.endDate,
        metadata: {
          imageUrl: imageUrl || undefined,
          transmission: car.transmission,
          duffelRateId: offerId,
        },
      };
    });
  }

  async reprice(input: TravelRepriceInput): Promise<TravelRepriceResult> {
    if (input.forceHigh) return this.sandbox.reprice(input);
    const offer = await this.api<Json>("GET", `/air/offers/${encodeURIComponent(input.quoteId)}`);
    const rawAmount = Number(offer.total_amount);
    const amount = money2(offer.total_amount as string);
    const currency = String(offer.total_currency ?? "").toUpperCase();
    const offerExpiry = String(offer.expires_at ?? "");
    if (!Number.isFinite(rawAmount) || rawAmount <= 0 || !/^[A-Z]{3}$/.test(currency) || !Number.isFinite(Date.parse(offerExpiry)) || Date.parse(offerExpiry) <= Date.now()) {
      throw new AppError("QUOTE_EXPIRED", "Provider offer expired; search again", 409);
    }
    return { quoteId: input.quoteId, amount, currency, changed: rawAmount !== Number(input.quotedAmount), offerExpiry };
  }

  async hold(input: TravelHoldInput): Promise<TravelHoldResult> { return this.sandbox.hold(input); }
  async confirm(input: TravelConfirmInput): Promise<TravelConfirmResult> { return this.sandbox.confirm(input); }
  async cancel(input: TravelCancelInput): Promise<TravelCancelResult> { return this.sandbox.cancel(input); }
  async refund(input: TravelRefundInput): Promise<TravelRefundResult> { return this.sandbox.refund(input); }
}
