import test from "node:test";
import assert from "node:assert/strict";
import { handlePushRegistration, notifyBoardChanged, providerToken, withPushNotifications, type PushConfig, type PushRepository } from "../lib/widget-push.ts";
import { fromBase64url, tokenHash, type DeviceRepository } from "../lib/device-pairing.ts";
import { validateBoardSpec, type BoardRepository } from "../lib/boards.ts";

const token = "ab".repeat(32);
const target = { deviceId: "phone", token, environment: "development" as const, boards: ["welcome"] };
const noStorage: PushRepository = { async register() {}, async targets() { return []; }, async invalidate() {} };
const keys = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
const privateKey = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.exportKey("pkcs8", keys.privateKey))));
const config: PushConfig = { keyId: "TESTKEY123", teamId: "TESTTEAM12", privateKey: `-----BEGIN PRIVATE KEY-----\n${privateKey}\n-----END PRIVATE KEY-----` };

test("widget registration uses device identity and rejects anonymous, expired, and malformed requests", async () => {
  const deviceToken = "d".repeat(43);
  const connection = { id: "alice-phone", ownerId: "alice", tokenHash: await tokenHash(deviceToken), name: "iPhone", createdAt: "2026-01-01", expiresAt: "2100-01-01" };
  const devices: DeviceRepository = { async save() {}, async list() { return []; }, async remove() {}, async find(hash) { return hash === connection.tokenHash ? connection : undefined; } };
  const writes: unknown[] = [];
  const pushes = { ...noStorage, async register(id: string, value: unknown) { writes.push([id, value]); } };
  const request = (headers = {}, input: unknown = { token, environment: "development", boards: ["welcome", "welcome"] }) => new Request("https://example.com/device/push", { method: "PUT", headers, body: JSON.stringify(input) });
  assert.equal((await handlePushRegistration(request(), devices, pushes, true)).status, 401);
  const headers = { "X-Widget-Device-Token": deviceToken, "oai-authenticated-user-id": "bob" };
  assert.deepEqual(await (await handlePushRegistration(request(headers), devices, pushes, false)).json(), { registered: true, deliveryConfigured: false });
  assert.deepEqual(writes, [["alice-phone", { token, environment: "development", boards: ["welcome"] }]]);
  assert.equal((await handlePushRegistration(request(headers, { token: "https://evil.example", environment: "development", boards: [] }), devices, pushes, true)).status, 422);
  connection.expiresAt = "2000-01-01";
  assert.equal((await handlePushRegistration(request(headers), devices, pushes, true)).status, 401);
  assert.equal(writes.length, 1);
});

test("provider JWT has a valid ES256 signature and is reused", async () => {
  const jwt = await providerToken(config);
  const [head, payload, signature] = jwt.split(".");
  assert.deepEqual(JSON.parse(new TextDecoder().decode(fromBase64url(head))), { alg: "ES256", kid: config.keyId });
  assert.equal(JSON.parse(new TextDecoder().decode(fromBase64url(payload))).iss, config.teamId);
  assert.equal(await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, keys.publicKey, fromBase64url(signature), new TextEncoder().encode(`${head}.${payload}`)), true);
  assert.equal(await providerToken(config), jwt);
});

test("board pushes use owner-scoped targets, the correct Apple environment and no board contents", async () => {
  const requests: Request[] = [];
  const pushes = { ...noStorage, async targets(owner: string, board: string) {
    assert.equal(owner, "alice"); assert.equal(board, "welcome");
    return [target, { ...target, deviceId: "phone2", environment: "production" as const }];
  } };
  const result = await notifyBoardChanged("alice", "welcome", pushes, config, async (url, init) => {
    requests.push(new Request(url, init)); return new Response(null, { status: 200 });
  });
  assert.deepEqual(result, { status: "accepted", accepted: 2, failed: 0 });
  assert.equal(new URL(requests[0].url).host, "api.sandbox.push.apple.com");
  assert.equal(new URL(requests[1].url).host, "api.push.apple.com");
  for (const request of requests) {
    assert.equal(request.redirect, "manual", "Cloudflare Workers rejects redirect:error; credentials must not follow redirects");
    assert.equal(request.headers.get("apns-push-type"), "widgets");
    assert.equal(request.headers.get("apns-topic"), "dev.widgetboard.app.push-type.widgets");
    assert.equal(request.headers.get("apns-priority"), "10", "Request immediate delivery rather than power-based batching");
    assert.match(request.headers.get("apns-id")!, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    assert.equal(request.headers.get("apns-collapse-id"), "widget-board-refresh");
    assert.deepEqual(await request.json(), { aps: { "content-changed": true } });
  }
  assert.notEqual(requests[0].headers.get("apns-id"), requests[1].headers.get("apns-id"));
});

test("stale Apple tokens are invalidated conditionally and temporary failures preserve registrations", async () => {
  const invalidated: unknown[] = [];
  const pushes = { ...noStorage, async targets() { return [target]; }, async invalidate(id: string, value: string) { invalidated.push([id, value]); } };
  const stale = await notifyBoardChanged("alice", "welcome", pushes, config, async () => Response.json({ reason: "Unregistered" }, { status: 410 }));
  assert.equal(stale.status, "failed");
  assert.deepEqual(invalidated, [["phone", token]]);
  await notifyBoardChanged("alice", "welcome", pushes, config, async () => Response.json({ reason: "TooManyRequests" }, { status: 429 }));
  assert.equal(invalidated.length, 1);
});

test("board save survives push failures and returns honest delivery status", async () => {
  const spec = validateBoardSpec({ root: "board", elements: { board: { type: "Board", props: { title: "Push test" }, children: ["note"] }, note: { type: "Note", props: { text: "hello", loud: false }, children: [] } } });
  let saved = false;
  const repository: BoardRepository = { async list() { return []; }, async get() { return undefined; }, async save(owner, id, value) { saved = true; return { id, spec: value, updatedAt: new Date().toISOString() }; } };
  const wrapped = withPushNotifications(repository, async (owner, board) => { assert.equal(saved, true); assert.equal(owner, "alice"); assert.equal(board, "welcome"); throw new Error("APNs offline"); });
  const result = await wrapped.save("alice", "welcome", spec);
  assert.equal(result.id, "welcome"); assert.equal(result.push?.status, "failed");
  assert.deepEqual(await notifyBoardChanged("alice", "welcome", noStorage), { status: "not_configured", accepted: 0, failed: 0 });
  assert.deepEqual(await notifyBoardChanged("alice", "welcome", noStorage, config), { status: "no_devices", accepted: 0, failed: 0 });
});
