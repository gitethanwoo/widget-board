import { z } from "zod";
import { catalogReference, specSchema, widgetWritingGuidance } from "./catalog/spec.ts";
import { authenticatedOwner, boardId, currentBoardId, checkWriteOrigin, errorText, json, readJson, validateBoardSpec, type BoardRepository } from "./boards.ts";

const setInput = z.strictObject({ spec: specSchema });
// Accept the old optional argument for already connected clients, but never use it
// to select a destination. Discovery exposes only the single-canvas schemas.
const legacySetInput = setInput.extend({ board: boardId.optional() });
const legacyGetInput = z.strictObject({ board: boardId.optional() });
const emptyInput = z.strictObject({});
const schema = (value: z.ZodType) => z.toJSONSchema(value, { target: "draft-7" });
const annotations = (readOnly: boolean) => ({ readOnlyHint: readOnly, destructiveHint: !readOnly, idempotentHint: true, openWorldHint: false });
const tools = [
  { name: "get_board", title: "Get widget board", description: "Read the single canvas shown on your iPhone before changing its content. There are no board names or destinations to choose.", inputSchema: schema(emptyInput), annotations: annotations(true) },
  { name: "set_board", title: "Set widget board", description: [
    "Replace the signed-in user's single canvas. This is always the content shown on their iPhone widgets. Read get_board first when preserving other content. No board name is needed.",
    "Saving sends a silent WidgetKit push to connected iPhones. The native app must be paired and push configured. The response's push field reports accepted, partial, failed, not_configured, or no_devices; accepted means APNs accepted the request, not proof the screen refreshed. iOS controls delivery; polling is the fallback.",
    "Use a flat json-render tree: root names the Board element; elements maps keys to {type, props, children}. Small widgets show the first leaf, including a Stat's optional supportingText below its value. Medium widgets add at most two supporting leaves. Full details are available in the app. Use at most 64 elements and 8 levels. No cycles, shared children, or unused elements.",
    catalogReference(),
  ].join("\n"), inputSchema: schema(setInput), annotations: annotations(false) },
];

const envelope = z.object({ jsonrpc: z.literal("2.0"), id: z.union([z.string(), z.number(), z.null()]).optional(), method: z.string(), params: z.record(z.string(), z.unknown()).optional() });
const versions = ["2026-07-28", "2025-11-25", "2025-06-18", "2025-03-26"];

export async function handleMcp(request: Request, repository: BoardRepository): Promise<Response> {
  let raw: unknown;
  try { checkWriteOrigin(request); } catch { return json({ error: "Forbidden origin." }, 403); }
  try { raw = await readJson(request); } catch { return json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Invalid or oversized JSON body." } }, 400); }
  const parsed = envelope.safeParse(raw);
  if (!parsed.success) return json({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "Invalid request." } }, 400);
  const { id, method, params } = parsed.data;
  // Notifications never invoke tools or mutate data.
  if (id === undefined) return new Response(null, { status: 202 });
  const result = (value: unknown) => json({ jsonrpc: "2.0", id, result: value });
  const failure = (code: number, message: string, status = 200) => json({ jsonrpc: "2.0", id, error: { code, message } }, status);
  if (method === "server/discover") return result({ supportedVersions: [versions[0]], capabilities: { tools: {} }, serverInfo: { name: "widget-board", version: "1.0.0" } });
  if (method === "initialize") return result({ protocolVersion: versions.includes(String(params?.protocolVersion)) ? params?.protocolVersion : "2025-11-25", capabilities: { tools: {} }, serverInfo: { name: "widget-board", version: "1.0.0" }, instructions: widgetWritingGuidance });
  if (method === "ping") return result({});
  // Discovery contains no user records. Sites dispatch gates access and uses this during plugin provisioning.
  if (method === "tools/list") return result({ tools });
  if (method !== "tools/call") return failure(-32601, "Method not found.");
  const owner = authenticatedOwner(request);
  if (!owner) return failure(-32001, "Sign in through the Widget Board Sites plugin to access your boards.", 401);
  const name = params?.name;
  if (name !== "list_boards" && !tools.some(tool => tool.name === name)) return failure(-32602, "Unknown tool.");
  let args;
  try {
    if (name === "list_boards") args = emptyInput.parse(params?.arguments ?? {});
    else if (name === "get_board") args = legacyGetInput.parse(params?.arguments ?? {});
    else { const input = legacySetInput.parse(params?.arguments); args = { ...input, spec: validateBoardSpec(input.spec) }; }
  } catch (error) { return result({ isError: true, content: [{ type: "text", text: errorText(error) }] }); }
  try {
    let value: unknown;
    if (name === "list_boards") {
      const board = await repository.get(owner, currentBoardId);
      value = { boards: board ? [board] : [] };
    }
    else if (name === "get_board") {
      value = await repository.get(owner, currentBoardId);
      if (!value) return result({ isError: true, content: [{ type: "text", text: "Your canvas is empty. Use set_board to put something on it." }] });
    } else {
      const input = args as z.infer<typeof setInput>;
      value = await repository.save(owner, currentBoardId, input.spec);
    }
    return result({ content: [{ type: "text", text: JSON.stringify(value) }] });
  } catch {
    return result({ isError: true, content: [{ type: "text", text: "Board storage is unavailable. Please retry." }] });
  }
}
