import { API_BASE_URL, USE_MOCK_API } from "@/services/api/config";
import { handleMockRequest, MockNotFoundError } from "@/services/api/mockBackend";
import { ensureAccessToken, getAccessToken, refreshAfterUnauthorized } from "@/services/api/session";
import { notifyUnauthorized } from "@/services/api/unauthorizedHandler";

interface ApiRequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  /**
   * Advisory only. Access tokens expire every 15 minutes, so a token captured
   * by a caller is often already stale; the live one from the session module
   * wins, and this is the fallback for the few calls made before a session
   * exists.
   */
  token?: string;
  /** Skips the Authorization header entirely (login, register, refresh). */
  anonymous?: boolean;
  query?: Record<string, string | number | boolean | null | undefined>;
  headers?: Record<string, string>;
  body?: unknown;
  signal?: AbortSignal;
}

export class ApiRequestError extends Error {
  readonly status: number;
  readonly detail: unknown;

  constructor(message: string, status: number, detail: unknown) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.detail = detail;
  }
}

const buildQueryString = (query?: ApiRequestOptions["query"]): string => {
  if (!query) {
    return "";
  }
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }
    params.append(key, String(value));
  });
  const encoded = params.toString();
  return encoded ? `?${encoded}` : "";
};

const extractErrorMessage = (status: number, payload: unknown): string => {
  if (typeof payload === "string" && payload.trim().length > 0) {
    return payload;
  }
  if (payload && typeof payload === "object") {
    const detail = (payload as { detail?: unknown }).detail;
    if (typeof detail === "string" && detail.trim().length > 0) {
      return detail;
    }
    if (Array.isArray(detail) && detail.length > 0) {
      const firstMessage = (detail[0] as { msg?: unknown }).msg;
      if (typeof firstMessage === "string" && firstMessage.trim().length > 0) {
        return firstMessage;
      }
    }
  }
  if (status === 413) {
    return "That file is too large (100 MB maximum)";
  }
  if (status === 502) {
    return "Storage provider is unavailable, try again";
  }
  return `Request failed with status ${status}`;
};

const parseResponsePayload = async (response: Response): Promise<unknown> => {
  if (response.status === 204) {
    return null;
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return response.json();
  }
  return response.text();
};

const isFormDataBody = (body: unknown): body is FormData => {
  if (!body || typeof body !== "object") {
    return false;
  }
  if (typeof FormData !== "undefined" && body instanceof FormData) {
    return true;
  }

  // React Native / polyfilled FormData can fail `instanceof` checks.
  const candidate = body as { append?: unknown; getParts?: unknown };
  const hasAppend = typeof candidate.append === "function";
  const hasParts = typeof candidate.getParts === "function";
  const tag = Object.prototype.toString.call(body);
  return tag === "[object FormData]" || (hasAppend && hasParts);
};

export async function apiRequest<TResponse>(path: string, options: ApiRequestOptions = {}): Promise<TResponse> {
  // Every typed API wrapper routes through here, so this is the single place the mock
  // backend has to stand in for the network.
  if (USE_MOCK_API) {
    const normalizedQuery: Record<string, string> = {};
    Object.entries(options.query ?? {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        normalizedQuery[key] = String(value);
      }
    });
    try {
      return handleMockRequest({
        method: options.method ?? "GET",
        path: path.startsWith("/") ? path : `/${path}`,
        query: normalizedQuery,
        body: (options.body ?? {}) as Record<string, unknown>
      }) as TResponse;
    } catch (error) {
      const status = error instanceof MockNotFoundError ? 404 : 500;
      const message = error instanceof Error ? error.message : "Mock request failed";
      throw new ApiRequestError(message, status, { detail: message });
    }
  }

  const query = buildQueryString(options.query);
  const url = `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}${query}`;

  const isFormData = isFormDataBody(options.body);
  const hasJsonBody = options.body !== undefined && options.body !== null && !isFormData;

  const send = async (token: string | null): Promise<Response> => {
    const headers: Record<string, string> = {
      ...options.headers
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    // Multipart must not carry an explicit Content-Type: only the client can
    // generate the boundary that goes with the body it is about to write.
    if (hasJsonBody && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }

    return fetch(url, {
      method: options.method ?? "GET",
      headers,
      body: hasJsonBody ? JSON.stringify(options.body) : isFormData ? (options.body as FormData) : undefined,
      signal: options.signal,
      credentials: "include"
    });
  };

  // A 15-minute access token expires often enough that refreshing up front is
  // the common path rather than the exception.
  const liveToken = options.anonymous ? null : (await ensureAccessToken()) ?? options.token ?? null;
  let response = await send(liveToken);

  // One retry, and only one: the refresh above already covered the predictable
  // case, so a 401 here means the token died mid-flight or was revoked.
  if (response.status === 401 && !options.anonymous) {
    const renewed = await refreshAfterUnauthorized();
    if (renewed) {
      response = await send(renewed);
    } else if (getAccessToken()) {
      response = await send(getAccessToken());
    }
  }

  const payload = await parseResponsePayload(response);

  if (!response.ok) {
    if (response.status === 401) {
      notifyUnauthorized({ status: response.status, path });
    }
    throw new ApiRequestError(extractErrorMessage(response.status, payload), response.status, payload);
  }

  return payload as TResponse;
}
