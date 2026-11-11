import { z } from "zod";
import { checkSpec, specSchema, type Spec } from "./catalog/spec.ts";

export const boardId = z.string().regex(/^[a-z0-9][a-z0-9-]{0,39}$/, "Use lowercase letters, digits and dashes, up to 40 characters.");
// Retain the original key so existing iPhone installations keep reading the same canvas.
export const currentBoardId = "welcome";
export type Board = { id: string; spec: Spec; updatedAt: string };
export interface BoardRepository {
  list(owner: string): Promise<Board[]>;
  get(owner: string, id: string): Promise<Board | undefined>;
  save(owner: string, id: string, spec: Spec): Promise<Board & { push?: import("./widget-push.ts").PushResult }>;
}

// Bound the graph before invoking json-render's structural validation or a renderer.
export function validateBoardSpec(input: unknown): Spec {
  const spec = specSchema.parse(input);
  const keys = Object.keys(spec.elements);
  if (keys.length > 64) throw new Error("A board can contain at most 64 elements.");
  const seen = new Set<string>();
  function visit(key: string, depth: number) {
    if (depth > 8) throw new Error("A board can be at most 8 levels deep.");
    if (seen.has(key)) throw new Error(`Element "${key}" is repeated or forms a cycle.`);
    if (!Object.hasOwn(spec.elements, key)) throw new Error(`Missing element "${key}".`);
    seen.add(key);
    for (const child of spec.elements[key].children) visit(child, depth + 1);
  }
  visit(spec.root, 1);
  if (seen.size !== keys.length) throw new Error("Every element must belong to the root's tree.");
  const checked = checkSpec(spec);
  if (!checked.ok) throw new Error(checked.problems.join("\n"));
  return checked.spec;
}

export function authenticatedOwner(request: Request): string | null {
  // Only trust these headers behind Sites dispatch. Do not expose the Worker directly.
  return request.headers.get("oai-authenticated-user-id") || null;
}

export function checkWriteOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) throw new Error("Cross-origin writes are not allowed.");
}

export async function readText(request: Request, maxBytes = 32_768): Promise<string> {
  if (Number(request.headers.get("content-length")) > maxBytes) throw new Error("Request body is too large.");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("A JSON body is required.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maxBytes) { await reader.cancel(); throw new Error("Request body is too large."); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return new TextDecoder().decode(bytes);
}

export async function readJson(request: Request): Promise<unknown> { return JSON.parse(await readText(request)); }

export function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}

export function errorText(error: unknown) {
  if (error instanceof z.ZodError) return error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("\n");
  return error instanceof Error ? error.message : "Invalid request.";
}
