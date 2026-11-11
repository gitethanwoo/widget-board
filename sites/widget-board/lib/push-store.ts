import { and, eq, gt, ne, isNotNull } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "../db/index";
import { deviceConnections } from "../db/schema";
import { notifyBoardChanged, pushRegistration, type PushConfig, type PushRepository } from "./widget-push";

export const pushes: PushRepository = {
  async register(deviceId, registration) {
    const db = getDb();
    await db.batch([
      // A reconnected phone must no longer receive updates for its old account.
      db.update(deviceConnections).set({ pushToken: null, pushBoards: null, pushEnvironment: null }).where(and(eq(deviceConnections.pushToken, registration.token), ne(deviceConnections.id, deviceId))),
      db.update(deviceConnections).set({ pushToken: registration.token, pushEnvironment: registration.environment, pushBoards: JSON.stringify(registration.boards) }).where(eq(deviceConnections.id, deviceId)),
    ]);
  },
  async targets(owner, _board) {
    const rows = await getDb().select().from(deviceConnections).where(and(eq(deviceConnections.ownerId, owner), gt(deviceConnections.expiresAt, new Date().toISOString()), isNotNull(deviceConnections.pushToken)));
    return rows.flatMap(row => {
      const parsed = pushRegistration.safeParse({ token: row.pushToken, environment: row.pushEnvironment, boards: JSON.parse(row.pushBoards ?? "[]") });
      return parsed.success && parsed.data.boards.length > 0 ? [{ ...parsed.data, deviceId: row.id }] : [];
    });
  },
  async invalidate(deviceId, token) {
    await getDb().update(deviceConnections).set({ pushToken: null, pushEnvironment: null, pushBoards: null }).where(and(eq(deviceConnections.id, deviceId), eq(deviceConnections.pushToken, token)));
  },
};

export function pushConfig(): PushConfig | undefined {
  if (env.APNS_TEAM_ID && env.APNS_KEY_ID && env.APNS_PRIVATE_KEY) return { teamId: env.APNS_TEAM_ID, keyId: env.APNS_KEY_ID, privateKey: env.APNS_PRIVATE_KEY };
}
export const pushBoardUpdate = (owner: string, board: string) => notifyBoardChanged(owner, board, pushes, pushConfig());
