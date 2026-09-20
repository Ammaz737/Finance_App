import type { CardIssuerProvider } from "./card-issuer.provider";

/** Mock card issuer. Real PAN never stored; only tokens and last4. */
export class MockCardIssuerAdapter implements CardIssuerProvider {
  issueVirtual() {
    const last4 = String(Math.floor(1000 + Math.random() * 9000));
    return { token: `tok_${last4}`, last4, network: "MOCK" };
  }

  authorize(input: { available: number; amount: number }): "APPROVED" | "DECLINED" {
    return input.available >= input.amount ? "APPROVED" : "DECLINED";
  }

  capture(input: { authorizedAmount: number; captureAmount: number }): "CAPTURED" | "DECLINED" {
    return input.captureAmount > 0 && input.captureAmount <= input.authorizedAmount ? "CAPTURED" : "DECLINED";
  }

  void(_input: { authorizedAmount: number }): "VOIDED" | "DECLINED" {
    return "VOIDED";
  }

  reverse(_input: { capturedAmount: number }): "REVERSED" | "DECLINED" {
    return "REVERSED";
  }
}
