import { z } from "zod";
import { boardId, json, readJson, type BoardRepository } from "./boards.ts";
import { authenticateDevice, base64url, type DeviceRepository } from "./device-pairing.ts";

export const pushRegistration = z.strictObject({
  token: z.string().regex(/^(?:[a-f0-9]{2}){16,256}$/),
  environment: z.enum(["development", "production"]),
  boards: z.array(boardId).max(64).transform(ids => [...new Set(ids)]),
});
export type PushRegistration = z.infer<typeof pushRegistration>;
export type PushTarget = PushRegistration & { deviceId: string };
export interface PushRepository {
  register(deviceId: string, registration: PushRegistration): Promise<void>;
  targets(owner: string, board: string): Promise<PushTarget[]>;
  invalidate(deviceId: string, token: string): Promise<void>;
}
export type PushResult = { status: "accepted" | "partial" | "failed" | "not_configured" | "no_devices"; accepted: number; failed: number };
export type PushConfig = { teamId: string; keyId: string; privateKey: string };

export async function handlePushRegistration(request: Request, devices: DeviceRepository, pushes: PushRepository, configured: boolean) {
  const connection = await authenticateDevice(request, devices);
  if (!connection) return json({ error: "Reconnect this iPhone in Widget Board." }, 401);
  let input: PushRegistration;
  try { input = pushRegistration.parse(await readJson(request)); }
  catch { return json({ error: "Invalid widget push registration." }, 422); }
  await pushes.register(connection.id, input);
  return json({ registered: true, deliveryConfigured: configured });
}

// One token is reused for 50 minutes; APNs rejects frequent provider-token rotation.
let cached: { keyId: string; teamId: string; privateKey: string; token: string; createdAt: number } | undefined;
export async function providerToken(config: PushConfig, now = Date.now()): Promise<string> {
  if (cached && cached.keyId === config.keyId && cached.teamId === config.teamId && cached.privateKey === config.privateKey && now - cached.createdAt < 50 * 60_000) return cached.token;
  const pem = config.privateKey.replace(/-----[^-]+-----/g, "").replace(/\s/g, "");
  const key = await crypto.subtle.importKey("pkcs8", Uint8Array.from(atob(pem), c => c.charCodeAt(0)), { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const encode = (value: unknown) => base64url(new TextEncoder().encode(JSON.stringify(value)));
  const message = `${encode({ alg: "ES256", kid: config.keyId })}.${encode({ iss: config.teamId, iat: Math.floor(now / 1_000) })}`;
  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(message));
  const token = `${message}.${base64url(new Uint8Array(signature))}`;
  cached = { ...config, token, createdAt: now };
  return token;
}

export async function notifyBoardChanged(owner: string, board: string, pushes: PushRepository, config?: PushConfig, send: typeof fetch = fetch): Promise<PushResult> {
  if (!config) return { status: "not_configured", accepted: 0, failed: 0 };
  const targets = await pushes.targets(owner, board);
  if (!targets.length) return { status: "no_devices", accepted: 0, failed: 0 };
  const authorization = `bearer ${await providerToken(config)}`;
  const results = await Promise.all(targets.map(async target => {
    const apnsId = crypto.randomUUID();
    try {
      const host = target.environment === "development" ? "api.sandbox.push.apple.com" : "api.push.apple.com";
      const response = await send(`https://${host}/3/device/${target.token}`, {
        // Workers supports manual/follow only. Never forward APNs credentials
        // through a redirect; a 3xx response is handled as a delivery failure.
        method: "POST", redirect: "manual", signal: AbortSignal.timeout(5_000),
        headers: {
          authorization, "content-type": "application/json", "apns-push-type": "widgets",
          // Widget pushes support immediate delivery. Priority 5 permits power-based batching.
          "apns-topic": "dev.widgetboard.app.push-type.widgets", "apns-priority": "10", "apns-id": apnsId,
          "apns-collapse-id": "widget-board-refresh", "apns-expiration": String(Math.floor(Date.now() / 1_000) + 3_600),
        },
        body: JSON.stringify({ aps: { "content-changed": true } }),
      });
      if (response.ok) {
        console.info("Widget push accepted by APNs", {
          apnsId, apnsUniqueId: response.headers.get("apns-unique-id"),
          environment: target.environment, priority: 10,
        });
        return true;
      }
      const error = await response.json().catch(() => ({})) as { reason?: string };
      // Invalidate this exact token only, so an in-flight send cannot erase a rotated token.
      if (response.status === 410 || error.reason === "BadDeviceToken" || error.reason === "DeviceTokenNotForTopic") await pushes.invalidate(target.deviceId, target.token);
      console.warn("Widget push rejected", { apnsId, status: response.status, reason: error.reason });
    } catch (error) {
      const message = error instanceof Error ? error.message.replaceAll(target.token, "[device]").replaceAll(authorization, "[authorization]").slice(0, 300) : "Unknown transport error";
      console.warn("Widget push delivery unavailable", { apnsId, message });
    }
    return false;
  }));
  const accepted = results.filter(Boolean).length;
  return { status: accepted === results.length ? "accepted" : accepted ? "partial" : "failed", accepted, failed: results.length - accepted };
}

export function withPushNotifications(repository: BoardRepository, notify: (owner: string, board: string) => Promise<PushResult>): BoardRepository {
  return {
    ...repository,
    async save(owner, id, spec) {
      const board = await repository.save(owner, id, spec);
      // Saving content is successful even if Apple or the push configuration is unavailable.
      try { return { ...board, push: await notify(owner, id) }; }
      catch { console.warn("Widget push unavailable after board save"); return { ...board, push: { status: "failed" as const, accepted: 0, failed: 0 } }; }
    },
  };
}
