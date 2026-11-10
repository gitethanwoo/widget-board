// Prints what the catalog really produces, so the server and the Swift
// decoder are written against observed output rather than assumptions.
import { validateSpec } from "@json-render/core";
import { widgetCatalog } from "../src/catalog.js";

const good = {
  root: "board",
  elements: {
    board: { type: "Board", props: { title: "Budget" }, children: ["left", "dining"] },
    left: {
      type: "Stat",
      props: { label: "Left this month", value: "$1,240", caption: "of $4,000", tone: "good" },
      children: [],
    },
    dining: {
      type: "Progress",
      props: { label: "Dining out", value: 0.62, caption: "$248 of $400", tone: "warn" },
      children: [],
    },
  },
};

const badProp = structuredClone(good);
// @ts-expect-error deliberately wrong type
badProp.elements.dining.props.value = "62%";

const badType = structuredClone(good);
badType.elements.left.type = "Chart";

const danglingChild = structuredClone(good);
danglingChild.elements.board.children.push("ghost");

const cases: Record<string, unknown> = { good, badProp, badType, danglingChild };
for (const [name, spec] of Object.entries(cases)) {
  const result = widgetCatalog.validate(spec);
  console.log(`\n=== catalog.validate(${name})`);
  console.log(JSON.stringify({ success: result.success, issues: result.error?.issues }, null, 2));
  console.log(`--- validateSpec(${name})`);
  // @ts-expect-error validateSpec wants a Spec; we are probing with raw objects
  console.log(JSON.stringify(validateSpec(spec), null, 2));
}

console.log("\n=== catalog.jsonSchema()");
console.log(JSON.stringify(widgetCatalog.jsonSchema(), null, 2));
