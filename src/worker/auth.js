// Login/logout handling + session verification.
// Password is checked against a bcrypt hash stored in the AUTH_KV namespace
// (seeded locally via scripts/hash-password.js — see DEPLOY.md).
// Sessions are signed JWTs (HS256, 24h expiry) in an httpOnly cookie.

import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { jsonResponse } from '../worker.js';

const SESSION_COOKIE = 'kyprofit_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24; // 24 hours

export async function handleLogin(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid request body' }, 400);
  }

  const email = (body.email || '').trim().toLowerCase();
  const password = body.password || '';

  if (!email || !password) {
    return jsonResponse({ error: 'Email and password are required' }, 400);
  }

  const storedHash = await env.AUTH_KV.get(`admin:${email}`);
  if (!storedHash) {
    // Same error as a wrong password — don't reveal whether the email exists.
    return jsonResponse({ error: 'Invalid email or password' }, 401);
  }

  const passwordMatches = await bcrypt.compare(password, storedHash);
  if (!passwordMatches) {
    return jsonResponse({ error: 'Invalid email or password' }, 401);
  }

  const secret = new TextEncoder().encode(env.JWT_SECRET);
  const token = await new SignJWT({ email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secret);

  const cookie = [
    `${SESSION_COOKIE}=${token}`,
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    'Path=/',
    `Max-Age=${SESSION_TTL_SECONDS}`,
  ].join('; ');

  return jsonResponse({ ok: true, email }, 200, { 'Set-Cookie': cookie });
}

export function handleLogout() {
  const cookie = [
    `${SESSION_COOKIE}=`,
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    'Path=/',
    'Max-Age=0',
  ].join('; ');

  return jsonResponse({ ok: true }, 200, { 'Set-Cookie': cookie });
}

// GET /api/auth/me — lets the frontend check "am I logged in?" on page load,
// without needing to attempt a real data request first.
export async function handleMe(request, env) {
  const session = await verifySession(request, env);
  if (!session) return jsonResponse({ error: 'Not authenticated' }, 401);
  return jsonResponse({ email: session.email });
}

// Used by protected /api/* routes from M4 onward.
export async function verifySession(request, env) {
  const cookieHeader = request.headers.get('Cookie') || '';
  const match = cookieHeader.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));
  if (!match) return null;

  try {
    const secret = new TextEncoder().encode(env.JWT_SECRET);
    const { payload } = await jwtVerify(match[1], secret);
    return payload; // { email, iat, exp }
  } catch {
    return null; // expired, tampered, or malformed
  }
}
