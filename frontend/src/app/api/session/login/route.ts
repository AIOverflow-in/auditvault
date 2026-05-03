// Proxy route: takes { email, password } from the browser, calls the Go
// backend /auth/login, and on success sets the av_session cookie before
// returning the user payload. The browser never sees the JWT directly.

import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { API_URL, SESSION_COOKIE } from '@/lib/api';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.email !== 'string' || typeof body.password !== 'string') {
    return NextResponse.json({ error: 'email and password are required' }, { status: 400 });
  }

  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: body.email, password: body.password }),
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json({ error: data.error ?? 'login failed' }, { status: res.status });
  }

  const expiresAt = new Date(data.expiresAt);
  cookies().set({
    name: SESSION_COOKIE,
    value: data.token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });

  return NextResponse.json({ user: data.user });
}
