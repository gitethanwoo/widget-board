// Generated from server/src; run node scripts/sync-sites-catalog.mjs from the repository root.
import { validateSpec } from "@json-render/core";
import { z } from "zod";
import { widgetCatalog } from "./catalog.ts";

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
    props: components[name].props as (typeof components)[Name]["props"],
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

/** Shared writing guidance for MCP initialization and tool discovery. */
export const widgetWritingGuidance = [
  "Help the user answer one question at a glance. Choose the smallest useful answer before choosing components.",
  "Default to one Stat (one label and one value) or one short Note. Empty space is intentional. A medium widget's extra capacity is optional, not a quota; add supporting items only when the user needs them at a glance.",
  "When a short comparison adds meaning, keep it inside the Stat as supportingText. Small widgets show label, styled value, and supportingText together. For example: This Week / $312.50 / Down 18% from last month. Do not flatten these into a Note or put the comparison in a separate leaf that the small widget hides. Omit supportingText when unnecessary; use caption for detail-only qualifications.",
  "Before saving, ask: if I remove this word or element, does the user lose meaning? If not, remove it. Avoid repeated headings, redundant currency codes, save timestamps, source commentary, and decorative status text.",
  "Simplicity must preserve meaning. Keep the time period, units, and essential scope or exclusions in the visible label/value. Captions and Board titles appear only in details, so never rely on them to explain what the main number means.",
  "Respect the requested calculation exactly. Excluding housing does not mean excluding every fixed expense. Use verified data; never invent an amount, budget, percentage, or freshness claim. Resolve material ambiguity from connected context or ask one focused question before calculating.",
  "Example: for weekly spending excluding housing, use label \"Week · excluding housing\" and the verified currency amount. Keep the reason housing is excluded and the exact date range in details. Do not add monthly totals, pending amounts, a budget, or a progress bar unless requested.",
  "Small widgets show the first leaf only; medium widgets may show the next two. Captions are detail-only; extra Stat, Progress, and Note leaves can appear on medium widgets. Keep unneeded report sections out of the canvas rather than filling the available space. Canvas save time is not source freshness.",
].join("\n");

/** Human/agent-readable component reference, generated from the catalog. */
export function catalogReference(): string {
  const lines: string[] = [widgetWritingGuidance];
  for (const [name, def] of Object.entries(components)) {
    lines.push(`- ${name}: ${def.description} Example props: ${JSON.stringify(def.example)}`);
  }
  return lines.join("\n");
}
