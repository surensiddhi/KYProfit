// Exchanges the Google service-account credentials for a short-lived OAuth2
// access token, so the Worker can call the Sheets API on the Sheet's behalf.
//
// Uses `jose` (Web Crypto based) instead of the `googleapis` npm package,
// because `googleapis` depends on Node APIs that don't exist in the
// Workers runtime.

import { SignJWT, importPKCS8 } from 'jose';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

// Simple in-memory cache — survives for the lifetime of the Worker isolate,
// which is usually long enough to save most repeated token exchanges.
// Not guaranteed to persist between requests, but costs nothing when it doesn't.
let cachedToken = null;
let cachedTokenExpiry = 0;

export async function getAccessToken(env) {
  const now = Math.floor(Date.now() / 1000);

  if (cachedToken && now < cachedTokenExpiry - 60) {
    return cachedToken;
  }

  const clientEmail = env.GOOGLE_CLIENT_EMAIL;
  const privateKeyRaw = env.GOOGLE_PRIVATE_KEY;

  if (!clientEmail || !privateKeyRaw) {
    throw new Error('Missing GOOGLE_CLIENT_EMAIL or GOOGLE_PRIVATE_KEY secret');
  }

  // Wrangler secrets store literal text; the PEM's real newlines can get
  // flattened to "\n" escape sequences when pasted — normalize either way.
  const privateKeyPem = privateKeyRaw.includes('\\n')
    ? privateKeyRaw.replace(/\\n/g, '\n')
    : privateKeyRaw;

  const key = await importPKCS8(privateKeyPem, 'RS256');

  const jwt = await new SignJWT({ scope: SCOPE })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(clientEmail)
    .setAudience(TOKEN_URL)
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Google token exchange failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  cachedToken = data.access_token;
  cachedTokenExpiry = now + (data.expires_in || 3600);
  return cachedToken;
}
