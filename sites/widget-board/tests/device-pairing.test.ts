import test from "node:test";
import assert from "node:assert/strict";
import { authenticateDevice, base64url, encryptCredential, fromBase64url, issueDeviceConnection, siteOrigin, tokenHash, type DeviceConnection, type DeviceCredential, type DeviceRepository } from "../lib/device-pairing.ts";
import { handleDeviceRead } from "../lib/device-http.ts";
import { handleMcp } from "../lib/mcp.ts";
import type { BoardRepository } from "../lib/boards.ts";

function store(): DeviceRepository & { records: Map<string, DeviceConnection> } {
  const records = new Map<string, DeviceConnection>();
  return { records, async save(row) { records.set(row.tokenHash, row); }, async find(hash) { return records.get(hash); }, async list(owner) { return [...records.values()].filter(row => row.ownerId === owner); }, async remove(owner, id) { for (const [hash, row] of records) if (row.ownerId === owner && row.id === id) records.delete(hash); } };
}
async function recipient() {
  const keys = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  return { keys, state: base64url(crypto.getRandomValues(new Uint8Array(32))), key: base64url(new Uint8Array(await crypto.subtle.exportKey("raw", keys.publicKey))) };
}
async function decrypt(callback: URL, privateKey: CryptoKey): Promise<DeviceCredential> {
  const value = (key: string) => fromBase64url(callback.searchParams.get(key)!);
  const peer = await crypto.subtle.importKey("raw", value("key"), { name: "ECDH", namedCurve: "P-256" }, false, []);
  const secret = await crypto.subtle.deriveBits({ name: "ECDH", public: peer }, privateKey, 256);
  const material = await crypto.subtle.importKey("raw", secret, "HKDF", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey({ name: "HKDF", hash: "SHA-256", salt: value("salt"), info: new TextEncoder().encode("widget-board-device-v1") }, material, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: value("nonce"), additionalData: new TextEncoder().encode(callback.searchParams.get("state")!) }, key, value("data"));
  return JSON.parse(new TextDecoder().decode(plaintext));
}
const fixture: DeviceCredential = { version: 1, baseURL: siteOrigin, deviceId: "07ec901b-2f67-49af-85e5-39509306f412", deviceToken: "a".repeat(43), gatewayToken: "test-gateway-not-a-credential", expiresAt: 4_102_444_800 };

test("only the originating device can decrypt the callback, and state is authenticated", async () => {
  const phone = await recipient();
  const callback = await encryptCredential(fixture, phone.state, phone.key);
  assert.equal(callback.protocol, "widgetboard:");
  assert.equal(callback.toString().includes(fixture.gatewayToken), false);
  assert.deepEqual(await decrypt(callback, phone.keys.privateKey), fixture);
  const other = await recipient();
  await assert.rejects(decrypt(callback, other.keys.privateKey));
  callback.searchParams.set("state", other.state);
  await assert.rejects(decrypt(callback, phone.keys.privateKey));
});

test("pairing stores only a hash and binds the read credential to the authenticated owner", async () => {
  const phone = await recipient(), devices = store();
  const callback = await issueDeviceConnection("alice", phone, fixture.gatewayToken, devices);
  const credential = await decrypt(callback, phone.keys.privateKey);
  const [record] = [...devices.records.values()];
  assert.equal(record.ownerId, "alice");
  assert.equal(record.tokenHash, await tokenHash(credential.deviceToken));
  assert.equal(JSON.stringify(record).includes(credential.deviceToken), false);
  assert.equal(JSON.stringify(record).includes(fixture.gatewayToken), false);
  assert.equal(credential.baseURL, siteOrigin);
});

test("device reads use their own owner regardless of supplied identity headers", async () => {
  const phone = await recipient(), devices = store();
  const credential = await decrypt(await issueDeviceConnection("alice", phone, fixture.gatewayToken, devices), phone.keys.privateKey);
  const calls: string[] = [];
  const boards: BoardRepository = { async list(owner) { calls.push(owner); return []; }, async get(owner, id) { assert.equal(id, "welcome"); calls.push(owner); return undefined; }, async save() { throw new Error("Device must never write"); } };
  const request = new Request(siteOrigin + "/device/boards", { headers: { "X-Widget-Device-Token": credential.deviceToken, "oai-authenticated-user-id": "bob" } });
  assert.equal((await handleDeviceRead(request, devices, boards)).status, 200);
  assert.deepEqual(calls, ["alice"]);
  const named = new Request(siteOrigin + "/device/boards/old-name", { headers: request.headers });
  assert.equal((await handleDeviceRead(named, devices, boards, "old-name")).status, 404);
  assert.deepEqual(calls, ["alice", "alice"]);
  assert.equal((await handleDeviceRead(new Request(request, { method: "PUT" }), devices, boards)).status, 405);
});

test("missing, expired, and revoked device credentials cannot read boards", async () => {
  const phone = await recipient(), devices = store();
  const credential = await decrypt(await issueDeviceConnection("alice", phone, fixture.gatewayToken, devices), phone.keys.privateKey);
  const request = new Request(siteOrigin + "/device/boards", { headers: { "X-Widget-Device-Token": credential.deviceToken } });
  const record = await authenticateDevice(request, devices);
  assert.equal(record?.ownerId, "alice");
  assert.equal(await authenticateDevice(new Request(siteOrigin), devices), undefined);
  record!.expiresAt = "2020-01-01T00:00:00.000Z";
  assert.equal(await authenticateDevice(request, devices), undefined);
  record!.expiresAt = "2100-01-01T00:00:00.000Z";
  await devices.remove("bob", credential.deviceId);
  assert.equal((await authenticateDevice(request, devices))?.ownerId, "alice");
  await devices.remove("alice", credential.deviceId);
  assert.equal(await authenticateDevice(request, devices), undefined);
});

test("a device credential cannot become a ChatGPT MCP writer", async () => {
  const boards = new Proxy({} as BoardRepository, { get() { throw new Error("Must not access storage"); } });
  const request = new Request(siteOrigin + "/mcp", { method: "POST", headers: { "X-Widget-Device-Token": fixture.deviceToken, "OAI-Sites-Authorization": "Bearer " + fixture.gatewayToken }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "set_board", arguments: { board: "note" } } }) });
  assert.equal((await handleMcp(request, boards)).status, 401);
});
