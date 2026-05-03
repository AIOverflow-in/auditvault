// Typed thin wrapper around the Go API. Server components call this directly
// (passing the JWT cookie via Next's cookies() helper); client components call
// the same Go endpoints via fetch with credentials: 'include'.

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';
export const SESSION_COOKIE = 'av_session';

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

type Init = Omit<RequestInit, 'body'> & {
  json?: unknown;
  token?: string | null;
};

export async function api<T>(path: string, init: Init = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.json !== undefined) {
    headers.set('Content-Type', 'application/json');
  }
  if (init.token) {
    headers.set('Authorization', `Bearer ${init.token}`);
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    body: init.json !== undefined ? JSON.stringify(init.json) : (init as RequestInit).body,
    credentials: 'include',
    cache: 'no-store',
  });

  const text = await res.text();
  const body: unknown = text ? safeJson(text) : null;

  if (!res.ok) {
    const message = isErrorBody(body) ? body.error : res.statusText;
    throw new ApiError(res.status, message, body);
  }
  return body as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function isErrorBody(b: unknown): b is { error: string } {
  return typeof b === 'object' && b !== null && 'error' in b && typeof (b as Record<string, unknown>).error === 'string';
}
