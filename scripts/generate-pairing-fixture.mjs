import { writeFile } from "node:fs/promises";
import { base64url, encryptCredential, siteOrigin } from "../sites/widget-board/lib/device-pairing.ts";

// Synthetic, disposable interoperability data. Never pass a live credential here.
const pair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
const privateKey = await crypto.subtle.exportKey("jwk", pair.privateKey);
const publicKey = base64url(new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey)));
const state = base64url(crypto.getRandomValues(new Uint8Array(32)));
const callback = await encryptCredential({
  version: 1,
  baseURL: siteOrigin,
  deviceId: "00000000-0000-4000-8000-000000000001",
  deviceToken: "a".repeat(43),
  gatewayToken: "test-gateway-not-a-credential",
  expiresAt: 4_102_444_800,
}, state, publicKey);
await writeFile(new URL("../ios/Tests/Fixtures/pairing.json", import.meta.url), JSON.stringify({
  _comment: "Synthetic interoperability fixture. Contains no real service or device credentials.",
  privateKey: privateKey.d,
  state,
  callback: callback.href,
}, null, 2) + "\n");
console.log("Wrote synthetic iOS pairing fixture for the configured service origin.");
