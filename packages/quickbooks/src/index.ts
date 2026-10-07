import crypto from "node:crypto";

export const QUICKBOOKS_ACCOUNTING_SCOPE = "com.intuit.quickbooks.accounting";
export type QuickBooksEnvironment = "sandbox" | "production";

export type QuickBooksTokenSet = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  refreshTokenExpiresIn?: number;
  scope: string;
};

export type QuickBooksEntity = {
  Id: string;
  SyncToken?: string;
  Name?: string;
  DisplayName?: string;
  FullyQualifiedName?: string;
  Active?: boolean;
  AccountType?: string;
  AccountSubType?: string;
  Classification?: string;
  CurrencyRef?: { value?: string; name?: string };
  [key: string]: unknown;
};

export type QuickBooksConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  environment: QuickBooksEnvironment;
};

const AUTH_URL = "https://appcenter.intuit.com/connect/oauth2";
const TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
const REVOKE_URL = "https://developer.api.intuit.com/v2/oauth2/tokens/revoke";

function basicAuth(config: QuickBooksConfig): string {
  return `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`;
}

function requireOk(response: Response, body: string): void {
  if (response.ok) return;
  let message = body || response.statusText;
  try {
    const parsed = JSON.parse(body) as { Fault?: { Error?: Array<{ Message?: string; Detail?: string }> }; error_description?: string };
    const fault = parsed.Fault?.Error?.[0];
    message = fault?.Detail || fault?.Message || parsed.error_description || message;
  } catch {
    // Keep provider response text when it is not JSON.
  }
  throw new Error(`QuickBooks request failed (${response.status}): ${message.slice(0, 500)}`);
}

export function buildQuickBooksAuthorizationUrl(config: QuickBooksConfig, state: string): string {
  const url = new URL(AUTH_URL);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", QUICKBOOKS_ACCOUNTING_SCOPE);
  url.searchParams.set("state", state);
  return url.toString();
}

async function tokenRequest(config: QuickBooksConfig, body: URLSearchParams): Promise<QuickBooksTokenSet> {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: basicAuth(config),
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const text = await response.text();
  requireOk(response, text);
  const value = JSON.parse(text) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    x_refresh_token_expires_in?: number;
    scope?: string;
  };
  if (!value.access_token || !value.refresh_token) throw new Error("QuickBooks token response is incomplete");
  return {
    accessToken: value.access_token,
    refreshToken: value.refresh_token,
    expiresIn: Number(value.expires_in),
    refreshTokenExpiresIn: value.x_refresh_token_expires_in != null ? Number(value.x_refresh_token_expires_in) : undefined,
    scope: value.scope || QUICKBOOKS_ACCOUNTING_SCOPE,
  };
}

export function exchangeQuickBooksCode(config: QuickBooksConfig, code: string): Promise<QuickBooksTokenSet> {
  return tokenRequest(config, new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: config.redirectUri,
  }));
}

export function refreshQuickBooksTokens(config: QuickBooksConfig, refreshToken: string): Promise<QuickBooksTokenSet> {
  return tokenRequest(config, new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }));
}

export async function revokeQuickBooksToken(config: QuickBooksConfig, token: string): Promise<void> {
  const response = await fetch(REVOKE_URL, {
    method: "POST",
    headers: { Authorization: basicAuth(config), Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  const text = await response.text();
  requireOk(response, text);
}

export function encryptProviderSecret(value: string, encryptionKey: string): string {
  if (!value) throw new Error("Cannot encrypt an empty provider secret");
  if (encryptionKey.length < 16) throw new Error("ENCRYPTION_KEY must contain at least 16 characters");
  const key = crypto.createHash("sha256").update(encryptionKey, "utf8").digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptProviderSecret(value: string, encryptionKey: string): string {
  const [version, ivPart, tagPart, dataPart] = value.split(".");
  if (version !== "v1" || !ivPart || !tagPart || !dataPart) throw new Error("Encrypted provider secret has an invalid format");
  const key = crypto.createHash("sha256").update(encryptionKey, "utf8").digest();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivPart, "base64url"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(dataPart, "base64url")), decipher.final()]).toString("utf8");
}

export class QuickBooksClient {
  private readonly baseUrl: string;
  private readonly realmId: string;
  private readonly accessToken: string;

  constructor(
    realmId: string,
    accessToken: string,
    environment: QuickBooksEnvironment,
  ) {
    this.realmId = realmId;
    this.accessToken = accessToken;
    const host = environment === "production" ? "quickbooks.api.intuit.com" : "sandbox-quickbooks.api.intuit.com";
    this.baseUrl = `https://${host}/v3/company/${encodeURIComponent(realmId)}`;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });
    const text = await response.text();
    requireOk(response, text);
    return text ? JSON.parse(text) as T : {} as T;
  }

  async companyInfo(): Promise<QuickBooksEntity> {
    const result = await this.request<{ CompanyInfo: QuickBooksEntity }>(`/companyinfo/${encodeURIComponent(this.realmId)}?minorversion=75`);
    return result.CompanyInfo;
  }

  async queryAll(entity: "Account" | "Vendor" | "Class" | "Department", activeOnly = false): Promise<QuickBooksEntity[]> {
    const rows: QuickBooksEntity[] = [];
    let start = 1;
    const pageSize = 1000;
    while (true) {
      const statement = `select * from ${entity}${activeOnly ? " where Active = true" : ""} startposition ${start} maxresults ${pageSize}`;
      const result = await this.request<{ QueryResponse?: Record<string, QuickBooksEntity[] | number> }>(`/query?query=${encodeURIComponent(statement)}&minorversion=75`);
      const page = (result.QueryResponse?.[entity] as QuickBooksEntity[] | undefined) ?? [];
      rows.push(...page);
      if (page.length < pageSize) break;
      start += pageSize;
    }
    return rows;
  }

  async create<T extends QuickBooksEntity>(entityPath: string, payload: Record<string, unknown>, requestId?: string): Promise<T> {
    const query = new URLSearchParams({ minorversion: "75" });
    if (requestId) query.set("requestid", requestId.slice(0, 50));
    const result = await this.request<Record<string, T>>(`/${entityPath.toLowerCase()}?${query.toString()}`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const key = Object.keys(result).find((candidate) => candidate.toLowerCase() === entityPath.toLowerCase());
    const created = key ? result[key] : undefined;
    if (!created?.Id) throw new Error(`QuickBooks did not return a ${entityPath} id`);
    return created;
  }
}

export function hashOAuthState(state: string): string {
  return crypto.createHash("sha256").update(state).digest("hex");
}

export function safeOAuthReturnPath(value?: string): string {
  return value?.startsWith("/app/accounting/") ? value : "/app/accounting/integrations";
}
