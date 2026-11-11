import { sqliteTable, text, primaryKey } from "drizzle-orm/sqlite-core";

export const boards = sqliteTable("boards", {
  ownerId: text("owner_id").notNull(),
  id: text("id").notNull(),
  spec: text("spec").notNull(),
  updatedAt: text("updated_at").notNull(),
}, table => [primaryKey({ columns: [table.ownerId, table.id] })]);

export const deviceConnections = sqliteTable("device_connections", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  name: text("name").notNull(),
  createdAt: text("created_at").notNull(),
  expiresAt: text("expires_at").notNull(),
  pushToken: text("push_token"),
  pushEnvironment: text("push_environment"),
  pushBoards: text("push_boards"),
});
