"use client";

export function AuditTimeline({ items }: { items: Array<{ action: string; at?: string }> }) {
  return (
    <ol className="timeline">
      {items.map((item, index) => (
        <li key={`${item.action}-${index}`}>
          {item.action} {item.at ? <span className="muted">{item.at}</span> : null}
        </li>
      ))}
    </ol>
  );
}
