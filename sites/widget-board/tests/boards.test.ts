import test from "node:test";
import assert from "node:assert/strict";
import { handleMcp } from "../lib/mcp.ts";
import { handleBoards } from "../lib/http.ts";
import { currentBoardId, validateBoardSpec, type Board, type BoardRepository } from "../lib/boards.ts";

const spec = { root: "board", elements: {
  board: { type: "Board", props: { title: "Reminder" }, children: ["note"] },
  note: { type: "Note", props: { text: "Call Mom", loud: true }, children: [] as string[] },
} };
function memoryStore(): BoardRepository {
  const users = new Map<string, Map<string, Board>>();
  return {
    async list(owner) { return [...(users.get(owner)?.values() ?? [])]; },
    async get(owner, id) { return users.get(owner)?.get(id); },
    async save(owner, id, value) {
      const board = { id, spec: value, updatedAt: new Date().toISOString() };
      if (!users.has(owner)) users.set(owner, new Map());
      users.get(owner)!.set(id, board);
      return board;
    },
  };
}
function mcpRequest(method: string, params: unknown = {}, owner?: string, extra = {}) {
  return new Request("https://widget.example/mcp", { method: "POST", headers: { "Content-Type": "application/json", ...(owner ? { "oai-authenticated-user-id": owner } : {}), ...extra }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
}
async function call(store: BoardRepository, owner: string | undefined, name: string, args = {}) {
  return handleMcp(mcpRequest("tools/call", { name, arguments: args }, owner), store);
}

test("discovery exposes only get and set for one canvas, strict schemas, and read annotations", async () => {
  const store = memoryStore();
  const discovery: any = await (await handleMcp(mcpRequest("server/discover"), store)).json();
  assert.deepEqual(discovery.result.supportedVersions, ["2026-07-28"]);
  const legacy: any = await (await handleMcp(mcpRequest("initialize", { protocolVersion: "2025-06-18" }), store)).json();
  assert.equal(legacy.result.protocolVersion, "2025-06-18");
  const list: any = await (await handleMcp(mcpRequest("tools/list"), store)).json();
  assert.deepEqual(list.result.tools.map((t: { name: string }) => t.name), ["get_board", "set_board"]);
  assert.equal(list.result.tools[1].inputSchema.additionalProperties, false);
  assert.equal(list.result.tools[0].annotations.readOnlyHint, true);
  assert.deepEqual(list.result.tools[0].inputSchema.properties, {});
  assert.deepEqual(Object.keys(list.result.tools[1].inputSchema.properties), ["spec"]);
});

test("anonymous calls cannot read or write and never reach storage", async () => {
  const store = new Proxy({} as BoardRepository, { get() { throw new Error("Storage must not be touched"); } });
  for (const name of ["list_boards", "get_board", "set_board"]) {
    assert.equal((await call(store, undefined, name, { board: "note", spec })).status, 401);
  }
  for (const method of ["GET", "PUT"]) {
    const response = await handleBoards(new Request("https://widget.example/boards/note", { method }), store, "note");
    assert.equal(response.status, 401);
  }
});

test("MCP saves round-trip over the HTTP reader with the native wire format", async () => {
  const store = memoryStore();
  const saved: any = await (await call(store, "alice", "set_board", { board: "note", spec })).json();
  assert.equal(saved.result.isError, undefined);
  const read = await handleBoards(new Request("https://widget.example/boards/note", { headers: { "oai-authenticated-user-id": "alice" } }), store, "note");
  assert.equal(read.headers.get("cache-control"), "private, no-store");
  const board = await read.json() as Board;
  assert.equal(board.id, currentBoardId);
  assert.deepEqual(board.spec, spec);
  assert.match(board.updatedAt, /\.\d{3}Z$/);
});

test("owners cannot list, read, or overwrite each other's board with the same ID", async () => {
  const store = memoryStore();
  await call(store, "alice", "set_board", { board: "note", spec });
  const list: any = await (await call(store, "bob", "list_boards")).json();
  assert.deepEqual(JSON.parse(list.result.content[0].text).boards, []);
  const get: any = await (await call(store, "bob", "get_board", { board: "note" })).json();
  assert.equal(get.result.isError, true);
  const second = structuredClone(spec); second.elements.note.props.text = "Bob's note";
  await call(store, "bob", "set_board", { board: "note", spec: second });
  assert.deepEqual((await store.get("alice", currentBoardId))?.spec, spec);
  assert.deepEqual((await store.get("bob", currentBoardId))?.spec, second);
});

test("invalid layouts are rejected without changing an existing board", async () => {
  const store = memoryStore();
  await call(store, "alice", "set_board", { board: "note", spec });
  const invalid = structuredClone(spec); invalid.elements.note.props.text = "x".repeat(141);
  const response: any = await (await call(store, "alice", "set_board", { board: "note", spec: invalid })).json();
  assert.equal(response.result.isError, true);
  assert.deepEqual((await store.get("alice", currentBoardId))?.spec, spec);
});

test("cycles, dangling references, unreachable elements, and oversized graphs cannot reach rendering", () => {
  const cycle = structuredClone(spec); cycle.elements.note.children = ["board"];
  assert.throws(() => validateBoardSpec(cycle), /cycle/);
  const missing = structuredClone(spec); missing.elements.board.children = ["missing"];
  assert.throws(() => validateBoardSpec(missing), /Missing element/);
  const unused = structuredClone(spec); unused.elements.board.children = [];
  assert.throws(() => validateBoardSpec(unused), /Every element/);
  const huge = { root: "board", elements: { ...spec.elements } as Record<string, unknown> };
  for (let i = 0; i < 65; i++) huge.elements[`note${i}`] = spec.elements.note;
  assert.throws(() => validateBoardSpec(huge), /64 elements/);
});

test("cross-origin writes fail before reaching storage", async () => {
  const store = memoryStore();
  const request = mcpRequest("tools/call", { name: "set_board", arguments: { board: "note", spec } }, "alice", { origin: "https://other.example" });
  assert.equal((await handleMcp(request, store)).status, 403);
  const put = new Request("https://widget.example/boards/note", { method: "PUT", headers: { "oai-authenticated-user-id": "alice", origin: "https://other.example" }, body: JSON.stringify({ spec }) });
  assert.equal((await handleBoards(put, store, "note")).status, 403);
  assert.deepEqual(await store.list("alice"), []);
});

test("JSON-RPC notifications do not execute mutation tools", async () => {
  const store = memoryStore();
  const request = new Request("https://widget.example/mcp", { method: "POST", headers: { "oai-authenticated-user-id": "alice" }, body: JSON.stringify({ jsonrpc: "2.0", method: "tools/call", params: { name: "set_board", arguments: { board: "note", spec } } }) });
  assert.equal((await handleMcp(request, store)).status, 202);
  assert.deepEqual(await store.list("alice"), []);
});

test("malformed and oversized bodies return a protocol error", async () => {
  for (const body of ["{", JSON.stringify({ value: "a".repeat(33_000) })]) {
    const response = await handleMcp(new Request("https://widget.example/mcp", { method: "POST", body }), memoryStore());
    assert.equal(response.status, 400);
    assert.equal((await response.json() as { error: { code: number } }).error.code, -32700);
  }
});

test("request arguments cannot select another owner", async () => {
  const store = memoryStore();
  const response: any = await (await call(store, "alice", "set_board", { board: "note", spec, owner: "bob" })).json();
  assert.equal(response.result.isError, true);
  assert.deepEqual(await store.list("bob"), []);
});


test("named legacy writes and unnamed writes update the same phone canvas", async () => {
  const store = memoryStore();
  await store.save("alice", "old-unrelated", validateBoardSpec(spec));
  for (const args of [{ board: "budget", spec }, { spec }]) {
    const saved: any = await (await call(store, "alice", "set_board", args)).json();
    assert.equal(JSON.parse(saved.result.content[0].text).id, currentBoardId);
  }
  assert.equal(await store.get("alice", "budget"), undefined);
  const read: any = await (await call(store, "alice", "get_board")).json();
  assert.deepEqual(JSON.parse(read.result.content[0].text).spec, spec);
  const list: any = await (await call(store, "alice", "list_boards")).json();
  assert.deepEqual(JSON.parse(list.result.content[0].text).boards.map((b: Board) => b.id), [currentBoardId]);
  const replacement = structuredClone(spec); replacement.elements.note.props.text = "New canvas";
  const request = new Request("https://widget.example/boards/another-name", { method: "PUT", headers: { "oai-authenticated-user-id": "alice" }, body: JSON.stringify({ spec: replacement }) });
  assert.equal((await handleBoards(request, store, "another-name")).status, 200);
  assert.deepEqual((await store.get("alice", currentBoardId))?.spec, replacement);
  const listed: any = await (await handleBoards(new Request("https://widget.example/boards", { headers: { "oai-authenticated-user-id": "alice" } }), store)).json();
  assert.deepEqual(listed.boards.map((b: Board) => b.id), [currentBoardId]);
});
