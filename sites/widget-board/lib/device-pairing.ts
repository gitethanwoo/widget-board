import { z } from "zod";

export const siteOrigin = "https://ethan-widget-board.ethanwoo.chatgpt.site";
const pairingContext = new TextEncoder().encode("widget-board-device-v1");
export const pairingInput = z.strictObject({
  state: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  key: z.string().regex(/^[A-Za-z0-9_-]{87}$/),
});
export type DeviceConnection = { id: string; ownerId: string; tokenHash: string; name: string; createdAt: string; expiresAt: string };
export interface DeviceRepository {
  save(connection: DeviceConnection): Promise<void>;
  find(tokenHash: string): Promise<DeviceConnection | undefined>;
  list(owner: string): Promise<DeviceConnection[]>;
  remove(owner: string, id: string): Promise<void>;
}
export type DeviceCredential = { version: number; baseURL: string; deviceId: string; deviceToken: string; gatewayToken: string; expiresAt: number };

export function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}
export function fromBase64url(value: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(value.replaceAll("-", "+").replaceAll("_", "/")), char => char.charCodeAt(0));
}
export async function tokenHash(token: string): Promise<string> {
  return base64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))));
}

// The callback contains only ciphertext. Only the native app that started this
// session holds the P-256 private key needed to open the credentials.
export async function encryptCredential(credential: DeviceCredential, state: string, publicKey: string): Promise<URL> {
  const recipient = await crypto.subtle.importKey("raw", fromBase64url(publicKey), { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ephemeral = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const shared = await crypto.subtle.deriveBits({ name: "ECDH", public: recipient }, ephemeral.privateKey, 256);
  const material = await crypto.subtle.importKey("raw", shared, "HKDF", false, ["deriveKey"]);
  const salt = crypto.getRandomValues(new Uint8Array(32));
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.deriveKey({ name: "HKDF", hash: "SHA-256", salt, info: pairingContext }, material, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce, additionalData: new TextEncoder().encode(state) }, key, new TextEncoder().encode(JSON.stringify(credential)));
  const callback = new URL("widgetboard://connect");
  callback.searchParams.set("state", state);
  callback.searchParams.set("key", base64url(new Uint8Array(await crypto.subtle.exportKey("raw", ephemeral.publicKey))));
  callback.searchParams.set("salt", base64url(salt));
  callback.searchParams.set("nonce", base64url(nonce));
  callback.searchParams.set("data", base64url(new Uint8Array(encrypted)));
  return callback;
}

export async function issueDeviceConnection(owner: string, input: z.infer<typeof pairingInput>, gatewayToken: string, repository: DeviceRepository): Promise<URL> {
  const now = Date.now();
  const expiresAt = now + 90 * 24 * 60 * 60 * 1_000;
  const deviceToken = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const id = crypto.randomUUID();
  const callback = await encryptCredential({ version: 1, baseURL: siteOrigin, deviceId: id, deviceToken, gatewayToken, expiresAt: expiresAt / 1_000 }, input.state, input.key);
  await repository.save({ id, ownerId: owner, tokenHash: await tokenHash(deviceToken), name: "iPhone", createdAt: new Date(now).toISOString(), expiresAt: new Date(expiresAt).toISOString() });
  return callback;
}

export async function authenticateDevice(request: Request, repository: DeviceRepository): Promise<DeviceConnection | undefined> {
  const token = request.headers.get("X-Widget-Device-Token");
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return;
  const connection = await repository.find(await tokenHash(token));
  if (!connection || Date.parse(connection.expiresAt) <= Date.now()) return;
  return connection;
}
