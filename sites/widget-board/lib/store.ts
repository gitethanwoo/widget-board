import { and, eq } from "drizzle-orm";
import { getDb } from "../db/index";
import { boards } from "../db/schema";
import { currentBoardId, type Board, type BoardRepository } from "./boards";
import { withPushNotifications } from "./widget-push";
import { pushBoardUpdate } from "./push-store";

function decode(row: typeof boards.$inferSelect): Board {
  return { id: row.id, spec: JSON.parse(row.spec), updatedAt: row.updatedAt };
}

const boardStorage: BoardRepository = {
  async list(owner) {
    const rows = await getDb().select().from(boards).where(and(eq(boards.ownerId, owner), eq(boards.id, currentBoardId)));
    return rows.map(decode);
  },
  async get(owner, _id) {
    const [row] = await getDb().select().from(boards).where(and(eq(boards.ownerId, owner), eq(boards.id, currentBoardId))).limit(1);
    return row ? decode(row) : undefined;
  },
  async save(owner, _id, spec) {
    const id = currentBoardId;
    const updatedAt = new Date().toISOString();
    await getDb().insert(boards).values({ ownerId: owner, id, spec: JSON.stringify(spec), updatedAt })
      .onConflictDoUpdate({ target: [boards.ownerId, boards.id], set: { spec: JSON.stringify(spec), updatedAt } });
    return { id, spec, updatedAt };
  },
};

export const repository = withPushNotifications(boardStorage, pushBoardUpdate);
