// Edge Middleware — the real gate. It runs on EVERY request to the newsletter
// (pages, brain, PDFs, data) BEFORE anything is served. No valid signed session
// cookie -> the request is rewritten to the public "under construction" page, so
// the protected content never leaves the server. This is true server-side access
// control: the ciphertext can't be downloaded and cracked offline.
import { next } from '@vercel/edge';

export const config = { matcher: ['/newsletter.html', '/newsletter/:path*', '/quantbench.html'] };

const enc = new TextEncoder();
function b64url(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function hmac(secret, msg) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(msg))));
}
function safeEq(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
function cookieVal(header, name) {
  if (!header) return '';
  for (const part of header.split(/;\s*/)) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i) === name) return part.slice(i + 1);
  }
  return '';
}

export default async function middleware(req) {
  const secret = process.env.SESSION_SECRET || '';
  const v = cookieVal(req.headers.get('cookie'), 'pl_session');
  let authed = false;
  if (v && secret) {
    const dot = v.lastIndexOf('.');
    if (dot > 0) {
      const exp = v.slice(0, dot), sig = v.slice(dot + 1);
      if (/^\d+$/.test(exp) && Number(exp) > Date.now()) {
        try { authed = safeEq(sig, await hmac(secret, exp)); } catch (_) { authed = false; }
      }
    }
  }
  if (authed) return next();
  const requested = new URL(req.url);
  const gate = new URL('/gate.html', requested.origin);
  gate.searchParams.set('next', requested.pathname + requested.search);
  return Response.redirect(gate, 307);
}
