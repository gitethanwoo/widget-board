import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { specSchema, type Spec } from "./spec.js";

const DATA_FILE = resolve(dirname(fileURLToPath(import.meta.url)), "../data/boards.json");

export const boardId = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]{0,39}$/, "lowercase letters, digits and dashes, up to 40 characters");

const boardSchema = z.object({
  id: boardId,
  spec: specSchema,
  updatedAt: z.iso.datetime(),
});
const fileSchema = z.record(z.string(), boardSchema);

export type Board = z.infer<typeof boardSchema>;

async function readAll(): Promise<Record<string, Board>> {
  let raw: string;
  try {
    raw = await readFile(DATA_FILE, "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return {};
    throw error;
  }
  return fileSchema.parse(JSON.parse(raw));
}

export async function getBoard(id: string): Promise<Board | undefined> {
  return (await readAll())[id];
}

export async function listBoards(): Promise<Board[]> {
  return Object.values(await readAll());
}

export async function saveBoard(id: string, spec: Spec): Promise<Board> {
  const all = await readAll();
  const board: Board = { id, spec, updatedAt: new Date().toISOString() };
  all[id] = board;
  await mkdir(dirname(DATA_FILE), { recursive: true });
  // Write-then-rename so a widget fetch never reads a half-written file.
  const tmp = `${DATA_FILE}.tmp`;
  await writeFile(tmp, JSON.stringify(all, null, 2));
  await rename(tmp, DATA_FILE);
  return board;
}
