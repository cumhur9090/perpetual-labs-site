// Clears the session cookie and bounces back to the gate — the "lock" link.
// A plain GET works (it's just a link). Removing the cookie means the next
// request to the newsletter has no valid session, so the middleware shows the gate.
export const config = { runtime: 'edge' };

export default function handler(req) {
  const origin = new URL(req.url).origin;
  const cookie = 'pl_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0';
  return new Response(null, { status: 303, headers: { Location: origin + '/newsletter.html', 'Set-Cookie': cookie } });
}
