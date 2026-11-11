import test from "node:test";
import assert from "node:assert/strict";
import { boardContent, widgetSummary } from "../lib/board-content.ts";
import { validateBoardSpec } from "../lib/boards.ts";
import { widgetCatalog } from "../lib/catalog/catalog.ts";
import { examples } from "../lib/catalog/examples.ts";
const spec = validateBoardSpec({ root: "b", elements: {
  b: { type: "Board", props: { title: "Spending" }, children: ["main", "row", "detail"] },
  main: { type: "Stat", props: { label: "Posted", value: "$8,241.56", caption: "Nov 1–10 · USD", tone: "default" }, children: [] },
  row: { type: "Row", props: {}, children: ["pending", "other"] },
  pending: { type: "Stat", props: { label: "Pending", value: "$640.21", caption: null, tone: "default" }, children: [] },
  other: { type: "Stat", props: { label: "Other", value: "$128.04", caption: null, tone: "default" }, children: [] },
  detail: { type: "Note", props: { text: "Source qualifications belong in the full canvas.", loud: false }, children: [] },
} });
test("widget sizes preserve one headline and add only two supporting fields", () => {
  assert.deepEqual(widgetSummary(spec, "small").blocks.map(b => b.id), ["main"]);
  assert.deepEqual(widgetSummary(spec, "medium").blocks.map(b => b.id), ["main", "pending", "other"]);
  assert.deepEqual(boardContent(spec).blocks.map(b => b.id), ["main", "pending", "other", "detail"]);
  assert.equal(widgetSummary(spec, "small").blocks[0].element, spec.elements.main);
});
test("a legacy repeated or cyclic reference cannot duplicate or hang the preview", () => {
  const malformed = structuredClone(spec);
  malformed.elements.row.children = ["main", "b", "missing"];
  assert.deepEqual(boardContent(malformed).blocks.map(b => b.id), ["main", "detail"]);
});

test("a small metric preserves its comparison without adding a hidden leaf", () => {
  const weekly = validateBoardSpec({ root: "b", elements: {
    b: { type: "Board", props: { title: null }, children: ["amount"] },
    amount: { type: "Stat", props: { label: "This Week", value: "$312.50", supportingText: "Down 18% from last month", caption: "Calculation details", tone: "accent" }, children: [] },
  } });
  const blocks = widgetSummary(weekly, "small").blocks;
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].element.type, "Stat");
  if (blocks[0].element.type !== "Stat") return;
  assert.equal(blocks[0].element.props.value, "$312.50");
  assert.equal(blocks[0].element.props.supportingText, "Down 18% from last month");
  assert.equal(blocks[0].element.props.caption, "Calculation details");
  assert.equal(validateBoardSpec(spec).elements.main.type, "Stat");
});

test("every approved example shows its first leaf on small and at most three leaves on medium", () => {
  for (const example of examples) {
    const spec = validateBoardSpec(example.spec);
    const root = spec.elements[spec.root];
    const leaves = root.children;
    const small = widgetSummary(spec, "small").blocks;
    const medium = widgetSummary(spec, "medium").blocks;
    assert.deepEqual(small.map(b => b.id), leaves.slice(0, 1), example.id);
    assert.deepEqual(medium.map(b => b.id), leaves.slice(0, 3), example.id);
    assert.equal(small[0].element, spec.elements[leaves[0]], example.id);
    assert.deepEqual(boardContent(spec).blocks.map(b => b.id), leaves, example.id);
  }
});

test("every component without slots is a leaf, so a new one is shown without a list to update", () => {
  const leafTypes = Object.entries(widgetCatalog.data.components).filter(([, component]) => component.slots.length === 0).map(([name]) => name);
  assert.ok(leafTypes.length >= 14);
  const shown = new Set<string>(examples.flatMap(example => boardContent(example.spec).blocks.map(block => block.element.type)));
  for (const type of leafTypes) assert.ok(shown.has(type), `${type} is never selected as a leaf`);
  assert.ok(!shown.has("Board") && !shown.has("Row"));

  const trend = examples.find(example => example.id === "number-sparkline");
  assert.ok(trend);
  const [headline] = widgetSummary(trend.spec, "small").blocks;
  assert.equal(headline.element.type, "Trend");
});

test("a leaf inside a Row is still found in document order", () => {
  const nested = validateBoardSpec({ root: "b", elements: {
    b: { type: "Board", props: { title: null }, children: ["row", "list"] },
    row: { type: "Row", props: {}, children: ["ring", "dots"] },
    ring: { type: "Ring", props: { label: "Fund", value: 0.62, tone: "accent" }, children: [] },
    dots: { type: "Dots", props: { label: "Reading", value: "2 days", days: [{ label: "M", state: "done" }, { label: "T", state: "today" }], tone: "good" }, children: [] },
    list: { type: "Checklist", props: { label: "Today", items: [{ text: "Call the bank", done: false }] }, children: [] },
  } });
  assert.deepEqual(widgetSummary(nested, "medium").blocks.map(b => b.element.type), ["Ring", "Dots", "Checklist"]);
});

test("the board's alert and updated footer reach the preview, and default to off", () => {
  const byId = (id: string) => {
    const found = examples.find(example => example.id === id);
    assert.ok(found, id);
    return widgetSummary(found.spec, "small");
  };
  assert.deepEqual([byId("needs-you").alert, byId("needs-you").showUpdated], [true, false]);
  assert.deepEqual([byId("all-clear").alert, byId("all-clear").showUpdated], [false, true]);
  assert.deepEqual([widgetSummary(spec, "medium").alert, widgetSummary(spec, "medium").showUpdated, widgetSummary(spec, "medium").title], [false, false, "Spending"]);
});
