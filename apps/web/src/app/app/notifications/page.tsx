"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader, StatusBadge } from "@finance/design-system";
import { api } from "@/lib/api";

type Notification = {
  id: string; type: string; title: string; body: string; href: string;
  readAt: string | null; createdAt: string;
};

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const list = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.get<Notification[]>("/notifications"),
  });

  const markRead = useMutation({
    mutationFn: (id: string) => api.post(`/notifications/${id}/mark-read`, {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      void queryClient.invalidateQueries({ queryKey: ["finance-overview"] });
    },
  });

  const markAll = useMutation({
    mutationFn: () => api.post("/notifications/mark-all-read", {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      void queryClient.invalidateQueries({ queryKey: ["finance-overview"] });
    },
  });

  const unread = (list.data ?? []).filter((item) => !item.readAt).length;

  return <div>
    <div className="resource-heading">
      <PageHeader title="Notifications" subtitle={`${unread} unread`} />
      <button className="btn btn-ghost" type="button" disabled={markAll.isPending || unread === 0} onClick={() => markAll.mutate()}>Mark all read</button>
    </div>
    {list.isError && <p className="error-panel" role="alert">Could not load notifications.</p>}
    <ul className="plain-list" aria-live="polite">
      {(list.data ?? []).map((item) => (
        <li key={item.id} className={item.readAt ? "muted" : undefined}>
          <div className="resource-heading">
            <div>
              <strong>{item.title}</strong>
              {!item.readAt && <> · <StatusBadge status="UNREAD" /></>}
              <div>{item.body}</div>
              <small>{new Date(item.createdAt).toLocaleString()} · {item.type}</small>
            </div>
            <div className="detail-actions">
              {item.href && <Link className="btn btn-ghost" href={item.href}>Open</Link>}
              {!item.readAt && <button className="btn btn-primary" type="button" disabled={markRead.isPending} onClick={() => markRead.mutate(item.id)}>Mark read</button>}
            </div>
          </div>
        </li>
      ))}
      {!list.isPending && !(list.data ?? []).length && <li className="muted">No notifications yet.</li>}
    </ul>
  </div>;
}
