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
    props: components[name].props as (typeof components)[Name]["props"],
    children: z.array(z.string()),
  });
}

const element = z.discriminatedUnion("type", [
  elementSchema("Board"),
  elementSchema("Row"),
  elementSchema("Stat"),
  elementSchema("Progress"),
  elementSchema("Ring"),
  elementSchema("Trend"),
  elementSchema("Columns"),
  elementSchema("BarList"),
  elementSchema("Split"),
  elementSchema("Rows"),
  elementSchema("Agenda"),
  elementSchema("Dots"),
  elementSchema("Grid"),
  elementSchema("Checklist"),
  elementSchema("Steps"),
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
    problems.push(...propProblems(key, el));
  }

  return problems.length > 0 ? { ok: false, problems } : { ok: true, spec };
}

/** Words that only repeat what a Note's status icon already shows. */
const redundantStatusText = {
  done: ["done", "finished", "complete", "completed", "success"],
  failed: ["failed", "failure", "error"],
  attention: ["attention", "needs attention", "needs you", "action needed"],
};

/** Rules that span more than one prop, which a per-field schema cannot express. */
function propProblems(key: string, el: Spec["elements"][string]): string[] {
  const problems: string[] = [];
  switch (el.type) {
    case "Progress": {
      const { supportingText, trailingText } = el.props;
      if (trailingText && !supportingText) {
        problems.push(`Progress "${key}" has trailingText without supportingText; trailingText is the right-hand end of that line.`);
      } else if (trailingText && supportingText && supportingText.length + trailingText.length > 22) {
        problems.push(`Progress "${key}": supportingText and trailingText share one line, so together they can be at most 22 characters.`);
      }
      break;
    }
    case "Columns": {
      const { columns, highlight } = el.props;
      if (highlight != null && highlight >= columns.length) {
        problems.push(`Columns "${key}": highlight ${highlight} is past the last column (${columns.length - 1}).`);
      } else if (highlight != null && columns[highlight]?.value == null) {
        problems.push(`Columns "${key}": the highlighted column has no value. Highlight the column the headline value belongs to.`);
      }
      break;
    }
    case "Grid": {
      const { offset, days } = el.props;
      if (offset + days.length > 42) problems.push(`Grid "${key}": offset plus days is ${offset + days.length}; the grid holds at most 42 cells.`);
      break;
    }
    case "Steps": {
      const { steps, current } = el.props;
      if (current >= steps.length) {
        problems.push(`Steps "${key}": current ${current} is past the last step (${steps.length - 1}). When the job is finished, use a Note with status "done".`);
      }
      break;
    }
    case "Note": {
      const { status, text } = el.props;
      const said = text.trim().toLowerCase().replace(/[.!]+$/, "");
      if (status && redundantStatusText[status].includes(said)) {
        problems.push(`Note "${key}": the ${status} icon already says "${text.trim()}". Use the text to say what ${status === "done" ? "finished" : status === "failed" ? "failed" : "is needed"}.`);
      }
      break;
    }
  }
  return problems;
}

/** Shared writing guidance for MCP initialization and tool discovery. */
export const widgetWritingGuidance = [
  "Help the user answer one question at a glance. Decide the question first, then call get_examples and adapt the design that answers that kind of question. Every example is a complete, valid spec.",
  "Default to one leaf. The first leaf is the whole small widget, so one design is one leaf: a chart, bar or list belongs to the component that draws it. Medium widgets add at most the next two leaves beside it; a single leaf on a medium widget spreads its chart or list across the width. Empty space is intentional and medium capacity is not a quota.",
  "Choose the component by what the data is, not by what looks rich. One number is a Stat. Use Trend, Columns, Progress, Ring, BarList, Split, Rows, Agenda, Dots, Grid, Checklist or Steps only when the user needs the extra shape at a glance and you have the data for it.",
  "When a short comparison adds meaning, keep it inside the Stat as supportingText, or as a change chip when the direction is the point. Small widgets show label, styled value, and supportingText together. For example: This Week / $312.50 / Down 18% from last month. Do not flatten these into a Note or put the comparison in a separate leaf that the small widget hides. Omit supportingText when unnecessary; use caption for detail-only qualifications.",
  "Before saving, ask: if I remove this word or element, does the user lose meaning? If not, remove it. Avoid repeated headings, redundant currency codes, source commentary, and decorative status text. When an icon, color or chip already says something, use the words to add information instead of repeating it. Never write a save time into text; set the Board's showUpdated when a stale board would mislead.",
  "Simplicity must preserve meaning. Keep the time period, units, and essential scope or exclusions in the visible label/value. Captions and Board titles appear only in details, so never rely on them to explain what the main number means.",
  "Respect the requested calculation exactly. Excluding housing does not mean excluding every fixed expense. Use verified data; never invent an amount, budget, percentage, or freshness claim. Chart points, bar fractions, segment shares and grid days are data too: send only values you have verified, never a plausible shape. Resolve material ambiguity from connected context or ask one focused question before calculating.",
  "Example: for weekly spending excluding housing, use label \"Week · excluding housing\" and the verified currency amount. Keep the reason housing is excluded and the exact date range in details. Do not add monthly totals, pending amounts, a budget, or a progress bar unless requested.",
  "Tone is semantic: color only what needs attention. The Board's alert paints the whole widget; reserve it for when the user must act now and clear it afterwards. Keep unneeded report sections out of the canvas rather than filling the available space.",
].join("\n");

/**
 * Human/agent-readable component reference, generated from the catalog.
 * Prop details are in the input schema and complete specs come from
 * get_examples, so this only says what each component is for.
 */
export function catalogReference(): string {
  const lines: string[] = [widgetWritingGuidance, "Components:"];
  for (const [name, def] of Object.entries(components)) {
    lines.push(`- ${name}: ${def.description}`);
  }
  return lines.join("\n");
}
