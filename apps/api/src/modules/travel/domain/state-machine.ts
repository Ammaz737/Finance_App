/** Travel lifecycle helpers for GF5. */
/** BOOKING: first mock hold moves the trip here; remaining QUOTED legs must stay bookable. */
export const TRAVEL_BOOKABLE = ["APPROVED", "READY_TO_BOOK", "BOOKING"] as const;
export const DEFAULT_REPRICE_TOLERANCE = 25;

export function canBookTrip(status: string): boolean {
  return (TRAVEL_BOOKABLE as readonly string[]).includes(status);
}

export function canSearchTrip(status: string): boolean {
  return ["DRAFT", "APPROVED", "READY_TO_BOOK", "PENDING_APPROVAL", "IN_REVIEW", "BOOKING"].includes(status);
}

export function evaluateRepriceTolerance(input: {
  quotedAmount: number;
  currentAmount: number;
  tolerance: number;
}): { withinTolerance: boolean; delta: number } {
  const delta = input.currentAmount - input.quotedAmount;
  return { withinTolerance: delta <= input.tolerance + 1e-9, delta };
}
