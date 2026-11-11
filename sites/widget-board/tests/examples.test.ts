import test from "node:test";
import assert from "node:assert/strict";
import { handleMcp } from "../lib/mcp.ts";
import { validateBoardSpec, type Board, type BoardRepository } from "../lib/boards.ts";
import { widgetCatalog } from "../lib/catalog/catalog.ts";
import { examples, examplesUsing, type Example } from "../lib/catalog/examples.ts";

type ToolResponse = { result: { isError?: boolean; content: { type: string; text: string }[] } };
/** A spec loosened just enough to break it on purpose. */
type LooseSpec = { root: string; elements: Record<string, { type: string; props: Record<string, unknown>; children: string[] }> };

function memoryStore(): BoardRepository & { saved: Board[] } {
  const saved: Board[] = [];
  return {
    saved,
    async list() { return saved.slice(-1); },
    async get() { return saved.at(-1); },
    async save(_owner, id, spec) {
      const board = { id, spec, updatedAt: new Date().toISOString() };
      saved.push(board);
      return board;
    },
  };
}
async function call(store: BoardRepository, name: string, args: unknown = {}, owner: string | null = "alice") {
  const request = new Request("https://widget.example/mcp", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(owner ? { "oai-authenticated-user-id": owner } : {}) },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }),
  });
  return handleMcp(request, store);
}
function example(id: string): LooseSpec {
  const found = examples.find(candidate => candidate.id === id);
  assert.ok(found, `No example "${id}"`);
  return structuredClone(found.spec);
}
function leaf(spec: LooseSpec, key: string) {
  const element = spec.elements[key];
  assert.ok(element, `No element "${key}"`);
  return element;
}

test("every example is a valid board with a first leaf and complete guidance", () => {
  assert.equal(examples.length, 28);
  assert.equal(new Set(examples.map(e => e.id)).size, examples.length);
  for (const e of examples) {
    const spec = validateBoardSpec(e.spec);
    assert.ok(spec.elements[spec.root].children.length >= 1, `${e.id} has no leaf`);
    for (const field of ["name", "question", "useWhen", "avoidWhen"] as const) assert.ok(e[field].trim().length > 0, `${e.id} is missing ${field}`);
    assert.match(e.id, /^[a-z][a-z-]+$/);
  }
});

test("every component and every board option has a worked example", () => {
  for (const name of Object.keys(widgetCatalog.data.components)) {
    if (name === "Row") continue; // Row only groups details; no approved design needs it.
    assert.ok(examplesUsing(name).length > 0, `No example uses ${name}`);
  }
  const boards = examples.map(e => e.spec.elements[e.spec.root]);
  assert.ok(boards.some(b => b.type === "Board" && b.props.alert === true));
  assert.ok(boards.some(b => b.type === "Board" && b.props.showUpdated === true));
});

test("get_examples returns every design without touching storage, and needs sign-in", async () => {
  const untouched = new Proxy({} as BoardRepository, { get() { throw new Error("Storage must not be touched"); } });
  assert.equal((await call(untouched, "get_examples", {}, null)).status, 401);
  const response = await (await call(untouched, "get_examples")).json() as ToolResponse;
  assert.equal(response.result.isError, undefined);
  const body = JSON.parse(response.result.content[0].text) as { guidance: string; examples: Example[] };
  assert.match(body.guidance, /verified data/i);
  assert.deepEqual(body.examples.map(e => e.id), examples.map(e => e.id));
  assert.deepEqual(body.examples[0].spec, examples[0].spec);
  const withArguments = await (await call(untouched, "get_examples", { id: "ring" })).json() as ToolResponse;
  assert.equal(withArguments.result.isError, true);
});

test("an agent can save every example exactly as returned", async () => {
  const store = memoryStore();
  for (const e of examples) {
    const response = await (await call(store, "set_board", { spec: e.spec })).json() as ToolResponse;
    assert.equal(response.result.isError, undefined, `${e.id}: ${response.result.content[0].text}`);
    assert.deepEqual(store.saved.at(-1)?.spec, e.spec);
  }
});

test("rules a single field cannot express are enforced, and each rejection names a working example", async () => {
  const cases: { name: string; spec: LooseSpec; problem: RegExp; hint: string }[] = [];
  let spec = example("remaining-bar");
  leaf(spec, "left").props.supportingText = null;
  cases.push({ name: "trailing text alone", spec, problem: /trailingText without supportingText/, hint: "Progress (remaining-bar" });
  spec = example("remaining-bar");
  leaf(spec, "left").props.supportingText = "of $4,000 budgeted";
  cases.push({ name: "bar captions too long for one line", spec, problem: /at most 22 characters/, hint: "Progress (remaining-bar" });
  spec = example("week-bars");
  leaf(spec, "today").props.highlight = 5;
  cases.push({ name: "highlighting a day that has not happened", spec, problem: /highlighted column has no value/, hint: "Columns (week-bars)" });
  spec = example("steps");
  leaf(spec, "pairing").props.current = 4;
  cases.push({ name: "a step past the end", spec, problem: /past the last step/, hint: "Steps (steps)" });
  spec = example("month-grid");
  leaf(spec, "nospend").props.offset = 6;
  leaf(spec, "nospend").props.days = Array.from({ length: 37 }, () => false);
  cases.push({ name: "a grid longer than six weeks", spec, problem: /at most 42 cells/, hint: "Grid (month-grid)" });
  spec = example("outcome");
  leaf(spec, "result").props.text = "Done!";
  cases.push({ name: "words that repeat the status icon", spec, problem: /icon already says/, hint: "Note (loud-reminder" });
  spec = example("number-delta");
  leaf(spec, "week").props.change = { direction: "down", text: "18% vs last week" };
  cases.push({ name: "a change chip with no sentiment", spec, problem: /change\.sentiment/, hint: "Stat (number-comparison" });
  spec = example("number-sparkline");
  leaf(spec, "checking").props.points = [4218];
  cases.push({ name: "a one-point trend", spec, problem: /props\.points/, hint: "Trend (number-sparkline, goal-line)" });

  for (const { name, spec: invalid, problem, hint } of cases) {
    const store = memoryStore();
    const response = await (await call(store, "set_board", { spec: invalid })).json() as ToolResponse;
    const text = response.result.content[0].text;
    assert.equal(response.result.isError, true, name);
    assert.match(text, problem, name);
    assert.ok(text.includes(`Call get_examples for a working ${hint}`), `${name}: ${text}`);
    assert.equal(store.saved.length, 0, name);
  }
});

test("a rejection with no recognizable component still points at the examples", async () => {
  const spec = example("rows");
  leaf(spec, "accounts").type = "Table";
  const response = await (await call(memoryStore(), "set_board", { spec })).json() as ToolResponse;
  assert.equal(response.result.isError, true);
  assert.match(response.result.content[0].text, /Call get_examples for complete valid specs\./);
});
