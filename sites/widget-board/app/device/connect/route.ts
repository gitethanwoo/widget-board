import { env } from "cloudflare:workers";
import { authenticatedOwner, json, readText } from "../../../lib/boards";
import { issueDeviceConnection, pairingInput } from "../../../lib/device-pairing";
import { devices } from "../../../lib/device-store";

export const dynamic = "force-dynamic";
// no-referrer makes browsers send Origin: null on this form POST. Keep the
// same-origin Origin check below, while withholding referrers from other sites.
const responseHeaders = { "Cache-Control": "private, no-store", "Referrer-Policy": "same-origin", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self' widgetboard:; frame-ancestors 'none'; base-uri 'none'", "X-Content-Type-Options": "nosniff" };

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = pairingInput.safeParse({ state: url.searchParams.get("state"), key: url.searchParams.get("key") });
  if (!parsed.success) return json({ error: "Open Connect from the Widget Board iPhone app." }, 400);
  if (!authenticatedOwner(request)) {
    return Response.redirect(new URL(`/signin-with-chatgpt?return_to=${encodeURIComponent(url.pathname + url.search)}`, url.origin), 303);
  }
  // Both values have a strict base64url alphabet; no untrusted HTML is inserted.
  const { state, key } = parsed.data;
  return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Connect your iPhone · Widget Board</title><style>body{background:#f6f5f0;color:#292d29;font:17px/1.6 system-ui;margin:0;padding:44px 24px}main{max-width:420px;margin:8vh auto}h1{font:38px/1.1 Georgia,serif;letter-spacing:-1px}p{color:#646d5d}button{font:inherit;width:100%;padding:15px;background:#3d5944;color:white;border:0;border-radius:12px;cursor:pointer}small{display:block;margin-top:20px;color:#6e746c}a{color:#3d5944}</style><main><p>WIDGET BOARD</p><h1>Your boards.<br>Your home screen.</h1><p>Connect the iPhone that opened this page. It can read your boards for 90 days, including while the app is closed. It cannot edit them.</p><form method="post" action="/device/connect"><input type="hidden" name="state" value="${state}"><input type="hidden" name="key" value="${key}"><button>Connect this iPhone</button></form><small>You can revoke access anytime in <a href="/devices">Connected devices</a>. Only continue if you started this from the Widget Board app.</small></main></html>`, { headers: { ...responseHeaders, "Content-Type": "text/html; charset=utf-8" } });
}

export async function POST(request: Request) {
  const owner = authenticatedOwner(request);
  if (!owner) return json({ error: "Sign in with ChatGPT before connecting a device." }, 401);
  if (request.headers.get("origin") !== new URL(request.url).origin) return json({ error: "Forbidden origin." }, 403);
  const token = (env as unknown as { DEVICE_GATEWAY_TOKEN?: string }).DEVICE_GATEWAY_TOKEN;
  if (!token) return json({ error: "Device access has not been configured." }, 503);
  let text: string;
  try { text = await readText(request, 2048); }
  catch { return json({ error: "Invalid connection request." }, 400); }
  const values = new URLSearchParams(text);
  const input = pairingInput.safeParse({ state: values.get("state"), key: values.get("key") });
  if (!input.success) return json({ error: "Invalid connection request. Start again from the iPhone app." }, 400);
  try {
    const callback = await issueDeviceConnection(owner, input.data, token, devices);
    return new Response(null, { status: 303, headers: { ...responseHeaders, Location: callback.toString() } });
  } catch { return json({ error: "Could not connect this device. Start again from the iPhone app." }, 400); }
}
