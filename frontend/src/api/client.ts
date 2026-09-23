import type { HealthResponse } from "../types/health";
import { getToken, setToken } from "../auth/session";

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const API_URL = (import.meta.env.VITE_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

export class ApiError extends Error {
  status: number;
  fields: Record<string, string>;
  retryAfter?: number;

  constructor(message: string, status: number, fields: Record<string, string> = {}) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

function parseError(body: unknown, status: number): ApiError {
  let message = "Не удалось выполнить запрос. Повторите попытку.";
  const fields: Record<string, string> = {};
  if (typeof body === "object" && body !== null && "detail" in body) {
    const detail = body.detail;
    if (typeof detail === "string") message = detail;
    else if (Array.isArray(detail)) {
      message = "Проверьте заполнение полей.";
      for (const issue of detail) {
        if (Array.isArray(issue.loc) && typeof issue.msg === "string") {
          const text = issue.msg.replace(/^Value error, /, "");
          fields[String(issue.loc.at(-1))] = /[а-яё]/i.test(text)
            ? text : "Недопустимое значение. Проверьте формат и длину поля.";
        }
      }
    } else if (typeof detail === "object" && detail !== null && "message" in detail) {
      message = String(detail.message);
      if ("field" in detail && typeof detail.field === "string") fields[detail.field] = message;
    }
  }
  return new ApiError(message, status, fields);
}

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/v1${path}`, {
      ...options,
      headers: { ...authHeaders(), ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers },
      signal: options.signal
        ? AbortSignal.any([options.signal, AbortSignal.timeout(10000)])
        : AbortSignal.timeout(10000),
    });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new ApiError("Сервис временно недоступен. Проверьте соединение и повторите попытку.", 0);
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 && path !== "/auth/login") setToken(null);
    const error = parseError(body, response.status);
    const retryAfter = Number(response.headers.get("Retry-After"));
    if (Number.isFinite(retryAfter) && retryAfter > 0) error.retryAfter = retryAfter;
    throw error;
  }
  return body as T;
}

export async function requestBlob(path: string, options: RequestInit = {}): Promise<Blob> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/v1${path}`, {
      ...options,
      headers: { ...authHeaders(), ...options.headers },
      signal: options.signal
        ? AbortSignal.any([options.signal, AbortSignal.timeout(10000)])
        : AbortSignal.timeout(10000),
    });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new ApiError("Сервис временно недоступен. Проверьте соединение и повторите попытку.", 0);
  }
  if (!response.ok) {
    if (response.status === 401) setToken(null);
    const body: unknown = await response.json().catch(() => null);
    throw parseError(body, response.status);
  }
  return response.blob();
}

export async function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  return request<HealthResponse>("/health", { signal });
}
