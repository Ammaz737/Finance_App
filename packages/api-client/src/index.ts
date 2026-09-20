export type ApiSuccess<T> = { data: T; meta?: { requestId?: string } };
export type ApiError = { error: { code: string; message: string; details?: unknown; requestId?: string } };

export class ApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly getToken: () => string | null,
  ) {}

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.headers ?? {}),
      },
    });
    const json = (await response.json()) as ApiSuccess<T> | ApiError;
    if (!response.ok || "error" in json) {
      const error = "error" in json ? json.error : { code: "HTTP_ERROR", message: response.statusText };
      throw Object.assign(new Error(error.message), error);
    }
    return json.data;
  }

  get<T>(path: string) {
    return this.request<T>(path);
  }

  post<T>(path: string, body?: unknown) {
    return this.request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined });
  }
}

export function createApiClient(baseUrl: string, getToken: () => string | null = () => null) {
  return new ApiClient(baseUrl, getToken);
}
