/**
 * Maps app-friendly MCC aliases / legacy tokens to Stripe Issuing
 * `spending_controls.allowed_categories` enum values.
 * Stripe rejects freeform values like "software" or "saas".
 */

/** Demo / product aliases → one or more Stripe Issuing categories. */
const CATEGORY_ALIASES: Record<string, string[]> = {
  software: [
    "computer_software_stores",
    "computers_peripherals_and_software",
    "computer_programming",
    "computer_network_services",
    "digital_goods_applications",
    "information_retrieval_services",
  ],
  saas: [
    "computer_software_stores",
    "digital_goods_applications",
    "computer_programming",
    "direct_marketing_subscription",
  ],
  office: [
    "stationary_office_supplies_printing_and_writing_paper",
    "stationery_stores_office_and_school_supply_stores",
    "office_and_commercial_furniture",
  ],
  grocery: ["grocery_stores_supermarkets", "miscellaneous_food_stores"],
  retail: ["miscellaneous_specialty_retail", "discount_stores", "department_stores"],
  meals: ["eating_places_restaurants", "fast_food_restaurants", "caterers"],
  restaurants: ["eating_places_restaurants", "fast_food_restaurants"],
  travel: [
    "airlines_air_carriers",
    "hotels_motels_and_resorts",
    "car_rental_agencies",
    "taxicabs_limousines",
    "passenger_railways",
    "bus_lines",
    "commuter_transport_and_ferries",
  ],
  airlines: ["airlines_air_carriers", "airports_flying_fields"],
  hotels: ["hotels_motels_and_resorts"],
  car_rental: ["car_rental_agencies"],
  ground_transportation: ["taxicabs_limousines", "bus_lines", "commuter_transport_and_ferries", "passenger_railways"],
  electronics: ["electronics_stores", "computer_software_stores"],
  general: ["miscellaneous", "miscellaneous_general_services"],
};

/** Common MCC numeric codes → Stripe category (travel seed + legacy controls). */
const MCC_TO_CATEGORY: Record<string, string> = {
  "4111": "commuter_transport_and_ferries",
  "4121": "taxicabs_limousines",
  "4511": "airlines_air_carriers",
  "7011": "hotels_motels_and_resorts",
  "7512": "car_rental_agencies",
  "5812": "eating_places_restaurants",
  "5411": "grocery_stores_supermarkets",
  "5734": "computer_software_stores",
  "5045": "computers_peripherals_and_software",
};

/** Stripe-looking category token (snake_case enum), not a short alias. */
function looksLikeStripeCategory(token: string): boolean {
  return /^[a-z][a-z0-9]*(?:_[a-z0-9]+)+$/.test(token);
}

/** Expand one user/token value into Stripe categories + original aliases for local matching. */
export function expandSpendingCategoryToken(raw: string): string[] {
  const token = raw.trim().toLowerCase();
  if (!token) return [];
  const out = new Set<string>([token]);
  const aliased = CATEGORY_ALIASES[token];
  if (aliased) {
    for (const category of aliased) out.add(category);
  }
  const fromMcc = MCC_TO_CATEGORY[token];
  if (fromMcc) out.add(fromMcc);
  // Reverse: Stripe category should also match its demo aliases for local rules.
  for (const [alias, categories] of Object.entries(CATEGORY_ALIASES)) {
    if (categories.includes(token)) out.add(alias);
  }
  return [...out];
}

/**
 * Convert a comma-separated or array control list into Stripe `allowed_categories` /
 * `blocked_categories` values. Throws if a token cannot be mapped.
 */
export function toStripeSpendingCategories(input?: string[] | null): string[] | undefined {
  if (!input?.length) return undefined;
  const out = new Set<string>();
  const unknown: string[] = [];

  for (const raw of input) {
    const token = String(raw ?? "").trim().toLowerCase();
    if (!token) continue;

    if (CATEGORY_ALIASES[token]) {
      for (const category of CATEGORY_ALIASES[token]) out.add(category);
      continue;
    }
    if (MCC_TO_CATEGORY[token]) {
      out.add(MCC_TO_CATEGORY[token]);
      continue;
    }
    if (looksLikeStripeCategory(token)) {
      out.add(token);
      continue;
    }
    unknown.push(raw.trim());
  }

  if (unknown.length) {
    const hint = "Use Stripe categories (e.g. computer_software_stores) or aliases: software, saas, office, grocery, meals, airlines, hotels, car_rental.";
    throw new Error(`Invalid spending category: ${unknown.join(", ")}. ${hint}`);
  }

  return out.size ? [...out] : undefined;
}

/** True when merchant category is allowed by a control list that may mix aliases + Stripe enums. */
export function categoryAllowedByControl(merchantCategory: string, controlList: string[]): boolean {
  if (!controlList.length || !merchantCategory.trim()) return true;
  const merchantExpanded = new Set(expandSpendingCategoryToken(merchantCategory));
  for (const token of controlList) {
    for (const candidate of expandSpendingCategoryToken(token)) {
      if (merchantExpanded.has(candidate)) return true;
    }
  }
  return false;
}

export function categoryBlockedByControl(merchantCategory: string, controlList: string[]): boolean {
  if (!controlList.length || !merchantCategory.trim()) return false;
  return categoryAllowedByControl(merchantCategory, controlList);
}
