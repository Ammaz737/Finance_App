export type OcrExtraction = {
  merchantGuess: string | null;
  amountGuess: string | null;
  currencyGuess: string | null;
  confidence: number;
  engine: string;
  raw: Record<string, unknown>;
};

export interface OcrProvider {
  extract(input: {
    attachmentId: string;
    mimeType: string;
    originalName: string;
    checksum: string;
  }): Promise<OcrExtraction>;
}
