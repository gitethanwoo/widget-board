import { validateSpec } from "@json-render/core";
import { z } from "zod";
import { widgetCatalog } from "./catalog.js";

/**
 * json-render's own catalog.validate() only checks component names: props
 * are typed as an open record, so a Progress with value "62%" passes (see
 * scripts/inspect-catalog.ts). Widgets can't recover from a bad spec, so we
 * build a strict per-component schema from the same catalog definitions and
 * validate with that instead.
 */
const components = widgetCatalog.data.components;

function elementSchema<Name extends keyof typeof components>(name: Name) {
  return z.strictObject({
    type: z.literal(name),
    props: components[name].props,
    children: z.array(z.string()),
  });
}

const element = z.discriminatedUnion("type", [
  elementSchema("Board"),
  elementSchema("Row"),
  elementSchema("Stat"),
  elementSchema("Progress"),
  elementSchema("Note"),
]);

export const specSchema = z.strictObject({
  root: z.string().describe("Key of the root element. It must be a Board."),
  elements: z
    .record(z.string(), element)
    .describe("Flat map of element key to element. Parents list child keys in `children`."),
});

export type Spec = z.infer<typeof specSchema>;

export type SpecCheck = { ok: true; spec: Spec } | { ok: false; problems: string[] };

/** Full check: per-component props, then the structural rules a widget needs. */
export function checkSpec(input: unknown): SpecCheck {
  const parsed = specSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      problems: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
    };
  }
  const spec = parsed.data;
  const problems: string[] = [];

  const structural = validateSpec(spec);
  for (const issue of structural.issues) {
    if (issue.severity === "error") problems.push(issue.message);
  }

  const root = spec.elements[spec.root];
  if (!root) {
    problems.push(`root "${spec.root}" does not exist in elements.`);
  } else if (root.type !== "Board") {
    problems.push(`root "${spec.root}" is a ${root.type}; the root must be a Board.`);
  }

  for (const [key, el] of Object.entries(spec.elements)) {
    const slots = components[el.type].slots;
    if (slots.length === 0 && el.children.length > 0) {
      problems.push(`"${key}" is a ${el.type}, which cannot have children.`);
    }
    if (el.type === "Board" && key !== spec.root) {
      problems.push(`"${key}" is a Board but is not the root. Only the root can be a Board.`);
    }
    if (el.type === "Row" && (el.children.length < 2 || el.children.length > 3)) {
      problems.push(`Row "${key}" has ${el.children.length} children; a Row takes 2 or 3.`);
    }
    for (const child of el.children) {
      if (spec.elements[child]?.type === "Row" && el.type === "Row") {
        problems.push(`Row "${key}" contains Row "${child}"; Rows cannot be nested.`);
      }
    }
  }

  return problems.length > 0 ? { ok: false, problems } : { ok: true, spec };
}

/** Human/agent-readable component reference, generated from the catalog. */
export function catalogReference(): string {
  const lines: string[] = [];
  for (const [name, def] of Object.entries(components)) {
    lines.push(`- ${name}: ${def.description} Example props: ${JSON.stringify(def.example)}`);
  }
  return lines.join("\n");
}
