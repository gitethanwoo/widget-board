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
      "A widget is small and cannot scroll. A small widget fits about 2 leaf blocks, a medium widget about 4.",
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
        title: z.string().max(40).nullable(),
      }),
      slots: ["default"],
      description:
        "Root container. Stacks its children vertically. Optional small title shown at the top.",
      example: { title: "Budget" },
    },
    Row: {
      props: z.strictObject({}),
      slots: ["default"],
      description: "Lays out 2 or 3 children side by side with equal width.",
      example: {},
    },
    Stat: {
      props: z.strictObject({
        label: z.string().max(24),
        value: z.string().max(16),
        caption: z.string().max(40).nullable(),
        tone,
      }),
      slots: [],
      description:
        "A big number with a small label above it and an optional caption below. The value is preformatted text, e.g. \"$1,240\" or \"72%\".",
      example: { label: "Groceries left", value: "$312", caption: "of $800", tone: "good" },
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
        "A labeled progress bar. value is a fraction from 0 to 1. The caption sits on the right, e.g. \"$1,240 of $2,000\".",
      example: { label: "Dining out", value: 0.62, caption: "$248 of $400", tone: "warn" },
    },
    Note: {
      props: z.strictObject({
        text: z.string().max(140),
        loud: z.boolean(),
      }),
      slots: [],
      description:
        "Free text. loud=true renders it large and bold for reminders like \"DON'T FORGET!!\".",
      example: { text: "Pick up the dry cleaning", loud: false },
    },
  },
});

export type WidgetSpec = typeof widgetCatalog._specType;
