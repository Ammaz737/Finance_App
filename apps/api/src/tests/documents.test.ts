import { describe, expect, it } from "vitest";
import { validateDocument } from "../engines/documents";

const meta = { name: "receipt.pdf", mimeType: "application/pdf", classification: "RECEIPT" as const };

describe("document quarantine admission", () => {
  it("accepts a matching PDF and rejects a spoofed type", () => {
    expect(() => validateDocument(Buffer.from("%PDF-1.7\nexample"), meta)).not.toThrow();
    expect(() => validateDocument(Buffer.from("<html>not a PDF</html>"), meta)).toThrowError(/matching file content/);
  });

  it("rejects oversized and unsafe file names before storage", () => {
    expect(() => validateDocument(Buffer.alloc(5 * 1024 * 1024 + 1), meta)).toThrowError(/5 MB/);
    expect(() => validateDocument(Buffer.from("%PDF-1.7"), { ...meta, name: "../receipt.pdf" })).toThrowError(/name is invalid/);
  });
});
