"use client";

import Link from "next/link";
import { PageHeader } from "@finance/design-system";

export default function TravelSearchPage() {
  return (
    <div className="spend-detail">
      <PageHeader title="Travel search" subtitle="Search flights, hotels, and cars from a trip" />
      <p className="muted">Open a trip to search and select normalized mock offers. Offer snapshots and reprice run before booking.</p>
      <Link className="btn btn-primary" href="/app/travel/trips">Go to trips</Link>
    </div>
  );
}
