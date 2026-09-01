import { get } from '@vercel/blob';

const enc = new TextEncoder();

function b64url(bytes) {
  let value = '';
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function hmac(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return b64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(message))));
}

function safeEq(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

function cookieVal(header, name) {
  if (!header) return '';
  for (const part of header.split(/;\s*/)) {
    const index = part.indexOf('=');
    if (index > 0 && part.slice(0, index) === name) return part.slice(index + 1);
  }
  return '';
}

async function isAuthenticated(req) {
  const secret = process.env.SESSION_SECRET || '';
  const value = cookieVal(req.headers.get('cookie'), 'pl_session');
  if (!value || !secret) return false;

  const dot = value.lastIndexOf('.');
  if (dot <= 0) return false;
  const expires = value.slice(0, dot);
  const signature = value.slice(dot + 1);
  if (!/^\d+$/.test(expires) || Number(expires) <= Date.now()) return false;

  try {
    return safeEq(signature, await hmac(secret, expires));
  } catch (_) {
    return false;
  }
}

function gateRedirect(req) {
  const requested = new URL(req.url);
  const gate = new URL('/gate.html', requested.origin);
  gate.searchParams.set('next', requested.pathname + requested.search);
  return Response.redirect(gate, 307);
}

function validPath(pathname) {
  return typeof pathname === 'string'
    && pathname.startsWith('quantbench/')
    && !pathname.includes('..')
    && !pathname.includes('\\')
    && !pathname.includes('\0');
}

function disposition(pathname, contentType) {
  const filename = pathname.split('/').pop().replace(/["\\]/g, '_');
  const inline = contentType === 'application/pdf'
    || contentType.startsWith('text/')
    || contentType.includes('json');
  return `${inline ? 'inline' : 'attachment'}; filename="${filename}"`;
}

export default async function handler(req) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
  }
  if (!(await isAuthenticated(req))) return gateRedirect(req);

  const requestUrl = new URL(req.url);
  const pathname = requestUrl.searchParams.get('path') || '';
  if (!validPath(pathname)) return new Response('Not Found', { status: 404 });

  const result = await get(pathname, {
    access: 'private',
    ifNoneMatch: req.headers.get('if-none-match') || undefined,
  });
  if (!result || result.statusCode === 404) return new Response('Not Found', { status: 404 });
  if (result.statusCode === 304) {
    return new Response(null, {
      status: 304,
      headers: {
        ETag: result.blob.etag,
        'Cache-Control': 'private, no-cache',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    });
  }

  const contentType = result.blob.contentType || 'application/octet-stream';
  const headers = {
    'Content-Type': contentType,
    'Content-Disposition': disposition(pathname, contentType),
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Robots-Tag': 'noindex, nofollow',
    ETag: result.blob.etag,
  };
  if (req.method === 'HEAD') return new Response(null, { status: 200, headers });
  return new Response(result.stream, { status: 200, headers });
}
