"use client";

export function ApprovalTimeline({ items }: { items: Array<{ label: string; status: string }> }) {
  return (
    <ol className="timeline">
      {items.map((item) => (
        <li key={item.label}>
          <strong>{item.label}</strong> — {item.status}
        </li>
      ))}
    </ol>
  );
}
