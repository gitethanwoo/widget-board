import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../db/index";
import { deviceConnections } from "../db/schema";
import type { DeviceRepository } from "./device-pairing";

export const devices: DeviceRepository = {
  async save(connection) { await getDb().insert(deviceConnections).values(connection); },
  async find(tokenHash) {
    const [device] = await getDb().select().from(deviceConnections).where(eq(deviceConnections.tokenHash, tokenHash)).limit(1);
    return device;
  },
  async list(owner) { return getDb().select().from(deviceConnections).where(eq(deviceConnections.ownerId, owner)).orderBy(desc(deviceConnections.createdAt)); },
  async remove(owner, id) { await getDb().delete(deviceConnections).where(and(eq(deviceConnections.ownerId, owner), eq(deviceConnections.id, id))); },
};
