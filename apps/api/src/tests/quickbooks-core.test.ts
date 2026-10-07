import { describe, expect, it, vi } from "vitest";
import {
  QuickBooksClient,
  buildQuickBooksAuthorizationUrl,
  decryptProviderSecret,
  encryptProviderSecret,
  exchangeQuickBooksCode,
  hashOAuthState,
} from "@finance/quickbooks";

const config = {
  clientId: "client-id",
  clientSecret: "client-secret",
  redirectUri: "https://api.example.test/api/v1/integrations/quickbooks/callback",
  environment: "sandbox" as const,
};

describe("QuickBooks integration core", () => {
  it("builds a state-bound accounting OAuth URL", () => {
    const url = new URL(buildQuickBooksAuthorizationUrl(config, "opaque-state"));
    expect(url.origin).toBe("https://appcenter.intuit.com");
    expect(url.searchParams.get("client_id")).toBe("client-id");
    expect(url.searchParams.get("scope")).toBe("com.intuit.quickbooks.accounting");
    expect(url.searchParams.get("state")).toBe("opaque-state");
    expect(url.searchParams.get("redirect_uri")).toBe(config.redirectUri);
  });

  it("encrypts provider credentials with authenticated encryption", () => {
    const encrypted = encryptProviderSecret("refresh-token", "a-development-key-with-enough-length");
    expect(encrypted).not.toContain("refresh-token");
    expect(decryptProviderSecret(encrypted, "a-development-key-with-enough-length")).toBe("refresh-token");
    expect(() => decryptProviderSecret(encrypted, "a-different-key-with-enough-length")).toThrow();
  });

  it("hashes OAuth state without retaining the browser token", () => {
    expect(hashOAuthState("state-value")).toHaveLength(64);
    expect(hashOAuthState("state-value")).toBe(hashOAuthState("state-value"));
    expect(hashOAuthState("state-value")).not.toBe(hashOAuthState("other-state"));
  });

  it("uses requestid when creating an accounting object", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ Purchase: { Id: "42" } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const client = new QuickBooksClient("realm-1", "access-token", "sandbox");
    const created = await client.create("Purchase", { PaymentType: "CreditCard" }, "entry-id");
    expect(created.Id).toBe("42");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("requestid=entry-id");
    vi.unstubAllGlobals();
  });

  it("exchanges the callback code with HTTP Basic authentication", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      access_token: "access",
      refresh_token: "refresh",
      expires_in: 3600,
      x_refresh_token_expires_in: 8_726_400,
      scope: "com.intuit.quickbooks.accounting",
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const tokens = await exchangeQuickBooksCode(config, "authorization-code");
    expect(tokens.accessToken).toBe("access");
    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(String((request.headers as Record<string, string>).Authorization)).toMatch(/^Basic /);
    expect(String(request.body)).toContain("grant_type=authorization_code");
    expect(String(request.body)).toContain("code=authorization-code");
    vi.unstubAllGlobals();
  });
});
