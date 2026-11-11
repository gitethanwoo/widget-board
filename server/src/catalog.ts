import { defineCatalog, defineSchema } from "@json-render/core";
import { z } from "zod";

/**
 * The widget schema uses json-render's standard flat spec format
 * ({ root, elements }) so the same spec can be drawn by the SwiftUI widget
 * renderer today and by other json-render renderers later.
 */
export const widgetSchema = defineSchema(
  (s) => ({
    spec: s.object({
      root: s.string(),
      elements: s.record(
        s.object({
          type: s.ref("catalog.components"),
          props: s.propsOf("catalog.components"),
          children: s.array(s.string()),
        }),
      ),
    }),
    catalog: s.object({
      components: s.map({
        props: s.zod(),
        slots: s.array(s.string()),
        description: s.string(),
        example: s.any(),
      }),
    }),
  }),
  {
    defaultRules: [
      "The root element MUST be a Board.",
      'Every element MUST include a "children" array. Leaf elements use an empty array.',
      "Design a glance, not a report. Put the most important leaf first: small widgets show only that leaf; medium widgets add at most the next two. Additional content is available in the app.",
    ],
  },
);

/**
 * Tones are semantic so the widget can pick colors that work in light,
 * dark and tinted home screens. Agents never send raw colors.
 */
export const tone = z.enum(["default", "accent", "good", "warn", "bad"]);

export const widgetCatalog = defineCatalog(widgetSchema, {
  components: {
    Board: {
      props: z.strictObject({
        title: z.string().max(40).nullable().describe("Optional detail-view title. Use null when the Stat label already provides the context."),
      }),
      slots: ["default"],
      description:
        "Root container. Order children by importance. The first leaf is the headline. The optional title is for the app detail view; it does not add a heading to the widget.",
      example: { title: "Budget" },
    },
    Row: {
      props: z.strictObject({}),
      slots: ["default"],
      description: "Groups 2 or 3 related details. Widget layouts adapt the group to available space; keep the headline before supporting details.",
      example: {},
    },
    Stat: {
      props: z.strictObject({
        label: z.string().max(24).describe("One concise label, including the essential time period or exclusion. Visible on the widget."),
        value: z.string().max(16).describe("The verified, formatted value, with its unit when needed; e.g. $312."),
        supportingText: z.string().max(40).nullable().optional().describe("Optional short comparison or context displayed below the styled value on small and medium widgets. Use only when useful at a glance; keep technical details in caption."),
        caption: z.string().max(40).nullable().describe("Optional detail-only context. Use null unless it adds useful information."),
        tone,
      }),
      slots: [],
      description:
        "One styled metric: label, prominent value, and optional supportingText below it. All three stay together on small and medium widgets. Use supportingText for a useful comparison, not a separate Note or a multiline plain-text replacement. Caption remains detail-only. The value is preformatted text, e.g. \"$1,240\" or \"72%\".",
      example: { label: "This Week", value: "$312.50", supportingText: "Down 18% from last month", caption: null, tone: "accent" },
    },
    Progress: {
      props: z.strictObject({
        label: z.string().max(24),
        value: z.number().min(0).max(1),
        caption: z.string().max(40).nullable(),
        tone,
      }),
      slots: [],
      description:
        "A labeled progress bar. value is a fraction from 0 to 1. The caption is available in the app details, e.g. \"$1,240 of $2,000\".",
      example: { label: "Dining out", value: 0.62, caption: "$248 of $400", tone: "warn" },
    },
    Note: {
      props: z.strictObject({
        text: z.string().max(140),
        loud: z.boolean(),
      }),
      slots: [],
      description:
        "One brief thought, ideally under 55 characters. Put longer explanations in a later Note for the app. loud=true emphasizes reminders like \"DON'T FORGET!!\".",
      example: { text: "Pick up the dry cleaning", loud: false },
    },
  },
});

export type WidgetSpec = typeof widgetCatalog._specType;
