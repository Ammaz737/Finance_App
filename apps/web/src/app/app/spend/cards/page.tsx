"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Legacy spend/cards list → corporate cards. */
export default function SpendCardsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/app/cards");
  }, [router]);
  return <p className="muted">Opening corporate cards…</p>;
}
