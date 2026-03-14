import { API_BASE_URL } from "@/services/api/config";
import { notifyUnauthorized } from "@/services/api/unauthorizedHandler";

interface ApiRequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  token?: string;
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

export async function apiRequest<TResponse>(path: string, options: ApiRequestOptions = {}): Promise<TResponse> {
  const query = buildQueryString(options.query);
  const url = `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}${query}`;

  const headers: Record<string, string> = {
    ...options.headers
  };

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  const hasJsonBody = options.body !== undefined && options.body !== null && !isFormData;

  if (hasJsonBody && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(url, {
    method: options.method ?? "GET",
    headers,
    body: hasJsonBody ? JSON.stringify(options.body) : isFormData ? (options.body as FormData) : undefined,
    signal: options.signal
  });

  const payload = await parseResponsePayload(response);

  if (!response.ok) {
    if (response.status === 401) {
      notifyUnauthorized({ status: response.status, path });
    }
    throw new ApiRequestError(extractErrorMessage(response.status, payload), response.status, payload);
  }

  return payload as TResponse;
}
