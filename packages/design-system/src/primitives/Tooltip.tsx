"use client";

export function Tooltip({ label }: { label: string }) {
  return <span title={label}>{label}</span>;
}
