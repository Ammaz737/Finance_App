"use client";

import type { InputHTMLAttributes } from "react";

export function MoneyInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className="input" inputMode="decimal" {...props} />;
}
