// Server-side helpers for reading the av_session JWT cookie and decoding the
// claims for SSR role checks. The cookie is set by the /api/session/login
// route after a successful Go API login.

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { API_URL, SESSION_COOKIE } from './api';

export type Session = {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    organizationId: string;
    organizationName: string;
    organizationType: string;
  };
};

// readSession returns the session for the current request, or null if the
// cookie is missing/invalid. Calls the Go /auth/me endpoint to verify and
// retrieve fresh user details.
export async function readSession(): Promise<Session | null> {
  const cookieStore = cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const res = await fetch(`${API_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) return null;
  const user = await res.json();
  return { token, user };
}

// requireSession redirects to /login if the user isn't authenticated.
export async function requireSession(): Promise<Session> {
  const s = await readSession();
  if (!s) redirect('/login');
  return s;
}

// requireRole redirects to /dashboard if the user doesn't have one of the
// allowed roles. Use it inside server components for hard role gates.
export async function requireRole(allowed: string[]): Promise<Session> {
  const s = await requireSession();
  if (!allowed.includes(s.user.role)) redirect('/dashboard');
  return s;
}

// fetchAPI calls the Go backend with the current session attached. Throws
// if there is no session. For client components, prefer the apiClient in
// src/lib/api.ts instead.
export async function fetchAPI<T>(path: string, init: RequestInit = {}): Promise<T> {
  const cookieStore = cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) throw new Error('no session');

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${path} → ${res.status}: ${text}`);
  }
  return (await res.json()) as T;
}
