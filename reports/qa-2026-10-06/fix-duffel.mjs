import fs from 'node:fs';const p='apps/api/src/integrations/travel/duffel.travel.adapter.ts';let s=fs.readFileSync(p,'utf8');const start=s.indexOf('  async reprice(');s=s.slice(0,start)+`  async reprice(input: TravelRepriceInput): Promise<TravelRepriceResult> {
    if (input.forceHigh) throw new AppError("TEST_ONLY", "Simulated repricing is only available with the mock provider", 409);
    const offer = await this.api<Json>("GET", \`/air/offers/\${encodeURIComponent(input.quoteId)}\`);
    const amount = String(offer.total_amount ?? "");
    const currency = String(offer.total_currency ?? "").toUpperCase();
    const offerExpiry = String(offer.expires_at ?? "");
    if (!amount || !currency || !Number.isFinite(Date.parse(offerExpiry)) || Date.parse(offerExpiry) <= Date.now()) {
      throw new AppError("QUOTE_EXPIRED", "Provider offer expired; search again", 409);
    }
    return { quoteId: input.quoteId, amount, currency, changed: amount !== input.quotedAmount, offerExpiry };
  }

  private bookingUnavailable(): never {
    throw new AppError("TRAVEL_BOOKING_UNAVAILABLE", "Live search is available, but provider booking, payment and refunds are not connected", 409);
  }

  async hold(_input: TravelHoldInput): Promise<TravelHoldResult> { return this.bookingUnavailable(); }
  async confirm(_input: TravelConfirmInput): Promise<TravelConfirmResult> { return this.bookingUnavailable(); }
  async cancel(_input: TravelCancelInput): Promise<TravelCancelResult> { return this.bookingUnavailable(); }
  async refund(_input: TravelRefundInput): Promise<TravelRefundResult> { return this.bookingUnavailable(); }
}
`;fs.writeFileSync(p,s);
