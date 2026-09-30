"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { PageHeader } from "@finance/design-system";
import { api } from "@/lib/api";

type Ref = { id: string; name?: string; currency?: string; legalEntityId?: string; status?: string };
type Line = {
  description: string;
  quantity: string;
  unitPrice: string;
  taxAmount: string;
  category: string;
  glAccount: string;
  department: string;
  location: string;
  project: string;
};

const emptyLine = (): Line => ({
  description: "",
  quantity: "1",
  unitPrice: "",
  taxAmount: "0",
  category: "",
  glAccount: "",
  department: "",
  location: "",
  project: "",
});

export default function NewBillPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    vendorId: "",
    legalEntityId: "",
    invoiceNumber: "",
    invoiceDate: "",
    dueDate: "",
    currency: "USD",
    memo: "",
    attachmentId: "",
    draft: true,
  });
  const [lines, setLines] = useState<Line[]>([emptyLine()]);

  const refs = useQuery({
    queryKey: ["bill-form-refs"],
    queryFn: async () => ({
      vendors: await api.get<Ref[]>("/vendors"),
      entities: await api.get<Ref[]>("/entities"),
    }),
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const contentBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      return api.post<{ id: string }>("/documents/upload", {
        name: file.name,
        mimeType: file.type,
        classification: "INVOICE",
        contentBase64,
      });
    },
    onSuccess: (value) => setForm({ ...form, attachmentId: value.id }),
  });

  const create = useMutation({
    mutationFn: () => {
      const calculated = lines.map((line) => ({
        ...line,
        amount: (Number(line.quantity) * Number(line.unitPrice) + Number(line.taxAmount || 0)).toFixed(2),
      }));
      const subtotal = lines.reduce((sum, line) => sum + Number(line.quantity) * Number(line.unitPrice), 0);
      const taxAmount = lines.reduce((sum, line) => sum + Number(line.taxAmount || 0), 0);
      return api.post<{ id: string }>("/bills", {
        ...form,
        subtotal: subtotal.toFixed(2),
        taxAmount: taxAmount.toFixed(2),
        amount: (subtotal + taxAmount).toFixed(2),
        lines: calculated,
        idempotencyKey: crypto.randomUUID(),
      });
    },
    onSuccess: (bill) => router.push(`/app/bill-pay/bills/${bill.id}`),
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    create.mutate();
  }

  function updateLine(index: number, patch: Partial<Line>) {
    setLines(lines.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  const total = lines.reduce(
    (sum, line) =>
      sum + Number(line.quantity || 0) * Number(line.unitPrice || 0) + Number(line.taxAmount || 0),
    0,
  );

  const vendors = (refs.data?.vendors ?? []).filter(
    (row) => row.status === "ACTIVE" && (!row.legalEntityId || row.legalEntityId === form.legalEntityId),
  );

  return (
    <div className="detail-page new-bill-page">
      <div className="resource-heading">
        <PageHeader
          title="Create bill"
          subtitle="Capture the invoice, controlled accounting coding, and source document."
        />
        <Link className="btn btn-ghost" href="/app/bill-pay/bills">
          Cancel
        </Link>
      </div>

      <form className="record-form panel" onSubmit={submit}>
        <div className="form-grid">
          <label>
            Legal entity
            <select
              className="input"
              required
              value={form.legalEntityId}
              onChange={(event) => {
                const entity = refs.data?.entities.find((row) => row.id === event.target.value);
                setForm({
                  ...form,
                  legalEntityId: event.target.value,
                  currency: entity?.currency ?? form.currency,
                  vendorId: "",
                });
              }}
            >
              <option value="">Select entity</option>
              {(refs.data?.entities ?? []).map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Vendor
            <select
              className="input"
              required
              value={form.vendorId}
              onChange={(event) => setForm({ ...form, vendorId: event.target.value })}
            >
              <option value="">Select vendor</option>
              {vendors.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Invoice number
            <input
              className="input"
              required
              value={form.invoiceNumber}
              onChange={(event) => setForm({ ...form, invoiceNumber: event.target.value })}
            />
          </label>
          <label>
            Invoice date
            <input
              className="input"
              type="date"
              value={form.invoiceDate}
              onChange={(event) => setForm({ ...form, invoiceDate: event.target.value })}
            />
          </label>
          <label>
            Due date
            <input
              className="input"
              type="date"
              value={form.dueDate}
              onChange={(event) => setForm({ ...form, dueDate: event.target.value })}
            />
          </label>
          <label>
            Currency
            <input className="input" value={form.currency} readOnly />
          </label>
          <label>
            Memo
            <input
              className="input"
              value={form.memo}
              onChange={(event) => setForm({ ...form, memo: event.target.value })}
            />
          </label>
          <label>
            Invoice document
            <input
              className="input"
              type="file"
              accept="application/pdf,image/png,image/jpeg"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) upload.mutate(file);
              }}
            />
          </label>
        </div>

        <fieldset>
          <legend>Line items</legend>
          {lines.map((line, index) => (
            <div className="form-grid" key={index}>
              {(
                [
                  ["description", "Description", "text"],
                  ["quantity", "Quantity", "number"],
                  ["unitPrice", "Unit price", "number"],
                  ["taxAmount", "Tax", "number"],
                  ["category", "Category", "text"],
                  ["glAccount", "GL account", "text"],
                  ["department", "Department", "text"],
                  ["location", "Location", "text"],
                  ["project", "Project / job", "text"],
                ] as const
              ).map(([key, label, type]) => (
                <label key={key}>
                  {label}
                  <input
                    className="input"
                    type={type}
                    step={type === "number" ? "0.01" : undefined}
                    required={["description", "quantity", "unitPrice"].includes(key)}
                    value={line[key]}
                    onChange={(event) => updateLine(index, { [key]: event.target.value })}
                  />
                </label>
              ))}
              <div>
                Line total: {form.currency}{" "}
                {(
                  Number(line.quantity || 0) * Number(line.unitPrice || 0) +
                  Number(line.taxAmount || 0)
                ).toFixed(2)}
              </div>
              <button
                className="btn btn-ghost"
                type="button"
                disabled={lines.length === 1}
                onClick={() => setLines(lines.filter((_, i) => i !== index))}
              >
                Remove line
              </button>
            </div>
          ))}
          <button className="btn btn-ghost" type="button" onClick={() => setLines([...lines, emptyLine()])}>
            Add line
          </button>
        </fieldset>

        <strong>
          Total (server validated): {form.currency} {total.toFixed(2)}
        </strong>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={form.draft}
            onChange={(event) => setForm({ ...form, draft: event.target.checked })}
          />{" "}
          Save as draft
        </label>
        {upload.isPending && <p className="muted">Uploading invoice…</p>}
        {(upload.error || create.error) && (
          <p className="error" role="alert">
            {(upload.error ?? create.error)?.message}
          </p>
        )}
        <button className="btn btn-primary" disabled={create.isPending || upload.isPending}>
          Create bill
        </button>
      </form>
    </div>
  );
}
