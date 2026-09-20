import type { OcrExtraction, OcrProvider } from "./ocr.provider";

/** Deterministic sandbox OCR — never claims a live vendor result. */
export class MockOcrAdapter implements OcrProvider {
  async extract(input: {
    attachmentId: string;
    mimeType: string;
    originalName: string;
    checksum: string;
  }): Promise<OcrExtraction> {
    const base = input.originalName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
    const merchantGuess = base || "Unknown merchant";
    const amountMatch = input.originalName.match(/(\d+(?:\.\d{1,2})?)/);
    return {
      merchantGuess,
      amountGuess: amountMatch?.[1] ?? null,
      currencyGuess: "USD",
      confidence: 0.72,
      engine: "mock-ocr",
      raw: {
        attachmentId: input.attachmentId,
        mimeType: input.mimeType,
        checksum: input.checksum,
      },
    };
  }
}
