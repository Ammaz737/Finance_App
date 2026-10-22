"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export function ReceiptDocument({ id, name }: { id: string; name: string }) {
  const [preview, setPreview] = useState<{ url: string; mimeType: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url); }, [preview]);
  async function open() {
    setLoading(true);
    setError("");
    try {
      const file = await api.get<{ mimeType: string; contentBase64: string }>(`/documents/${id}/content`);
      const bytes = Uint8Array.from(atob(file.contentBase64), (character) => character.charCodeAt(0));
      setPreview({ url: URL.createObjectURL(new Blob([bytes], { type: file.mimeType })), mimeType: file.mimeType });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not open this document. Try again.");
    } finally { setLoading(false); }
  }
  return (
    <section className="record-form" aria-label="Uploaded receipt or invoice">
      <h3 style={{ margin: "12px 0 0", fontSize: 14 }}>Receipt / invoice</h3>
      <p style={{ margin: 0, overflowWrap: "anywhere" }}>{name}</p>
      {!preview && <button type="button" className="btn btn-ghost" onClick={() => void open()} disabled={loading}>
        {loading ? "Opening document…" : "View receipt / invoice"}
      </button>}
      {error && <p className="error" role="alert">{error}</p>}
      {preview && <>
        <div className="detail-actions">
          <a className="btn btn-ghost" href={preview.url} target="_blank" rel="noopener noreferrer">Open in new tab</a>
          <a className="btn btn-ghost" href={preview.url} download={name}>Download</a>
          <button className="btn btn-ghost" type="button" onClick={() => setPreview(null)}>Close preview</button>
        </div>
        {preview.mimeType === "application/pdf"
          ? <iframe src={preview.url} title={`Receipt: ${name}`} style={{ width: "100%", height: 480, border: "1px solid #ddd", borderRadius: 8 }} />
          // Uploaded images use an authenticated Blob URL rather than a public asset URL.
          // eslint-disable-next-line @next/next/no-img-element
          : <img src={preview.url} alt={`Receipt: ${name}`} style={{ maxWidth: "100%", height: "auto" }} />}
      </>}
    </section>
  );
}
