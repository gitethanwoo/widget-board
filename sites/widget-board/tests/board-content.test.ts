import test from "node:test";
import assert from "node:assert/strict";
import { boardContent, widgetSummary } from "../lib/board-content.ts";
import { validateBoardSpec } from "../lib/boards.ts";
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
