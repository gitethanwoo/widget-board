// Generated from server/src; run node scripts/sync-sites-catalog.mjs from the repository root.
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
      "One design is one leaf. A chart, bar or list belongs to the component that draws it, so the small widget never loses it.",
    ],
  },
);

/**
 * Tones are semantic so the widget can pick colors that work in light,
 * dark and tinted home screens. Agents never send raw colors.
 */
export const tone = z.enum(["default", "accent", "good", "warn", "bad"]);

/**
 * A change chip: an arrow, the size of the change, and a color. Whether a
 * fall is good news depends on what is being measured, so the agent states
 * the sentiment and the phone never guesses it from the direction.
 */
export const change = z.strictObject({
  direction: z.enum(["up", "down", "flat"]).describe("Which way the value moved. The phone draws the arrow."),
  text: z.string().min(1).max(18).describe('The size of the change and what it is against, without an arrow; e.g. "18% vs last week".'),
  sentiment: z
    .enum(["good", "bad", "neutral"])
    .describe("Whether this change is good news for the user. Down is good for spending and bad for savings, so decide deliberately; the chip is colored from this."),
});

const supportingText = (max: number, about: string) => z.string().max(max).nullable().optional().describe(about);

export const widgetCatalog = defineCatalog(widgetSchema, {
  components: {
    Board: {
      props: z.strictObject({
        title: z.string().max(40).nullable().describe("Optional detail-view title. Use null when the first leaf's label already provides the context."),
        alert: z
          .boolean()
          .optional()
          .describe("true paints the whole widget orange. Only when the user must act now, and clear it afterwards. Say what is needed in words too: tinted Home Screens remove the color."),
        showUpdated: z
          .boolean()
          .optional()
          .describe('true draws a small "Updated 7:02 AM" footer from the time you saved. Use it when a stale board would mislead, such as an all-clear. Never write a save time into text yourself.'),
      }),
      slots: ["default"],
      description:
        "Root container. Order children by importance. The first leaf is the headline. The optional title is for the app detail view; it does not add a heading to the widget.",
      example: { title: null },
    },
    Row: {
      props: z.strictObject({}),
      slots: ["default"],
      description: "Groups 2 or 3 related details. Widget layouts adapt the group to available space; keep the headline before supporting details.",
      example: {},
    },
    Stat: {
      props: z.strictObject({
        label: z
          .string()
          .max(24)
          .describe('One concise label, including the essential time period or exclusion. Visible on the widget. Use "" only when the value is a complete statement, e.g. "All clear".'),
        value: z.string().max(16).describe("The verified, formatted value, with its unit when needed; e.g. $312."),
        supportingText: supportingText(40, "Optional short comparison or context displayed below the styled value on small and medium widgets. Use only when useful at a glance; keep technical details in caption."),
        change: change.nullable().optional().describe("Optional change chip under the value, for when the direction of change is the point."),
        caption: z.string().max(40).nullable().describe("Optional detail-only context. Use null unless it adds useful information."),
        tone,
      }),
      slots: [],
      description:
        "One styled metric: label, prominent value, and optional supportingText or change chip below it. They stay together on small and medium widgets. Use supportingText for a useful comparison, not a separate Note or a multiline plain-text replacement. Caption remains detail-only. The value is preformatted text, e.g. \"$1,240\", \"21 days\" or \"Yes\".",
      example: { label: "This Week", value: "$312.50", supportingText: "Down 18% from last month", caption: null, tone: "accent" },
    },
    Progress: {
      props: z.strictObject({
        label: z.string().max(24),
        value: z.number().min(0).max(1).describe("How full the bar is, from 0 to 1."),
        display: z
          .string()
          .max(16)
          .nullable()
          .optional()
          .describe('Headline above the bar when a percentage is not the answer, e.g. "$1,240" or "$51 over". Omit to show the percentage.'),
        marker: z
          .number()
          .min(0)
          .max(1)
          .nullable()
          .optional()
          .describe("Draws a tick on the bar where the value should be by now, e.g. 0.667 on day 20 of 30. Use it for pace against a budget or deadline."),
        supportingText: supportingText(40, 'One line under the bar that adds what the bar cannot: what it is out of, a step, a day count; e.g. "Step 5 of 7 · running tests".'),
        trailingText: supportingText(16, 'Right-hand end of the supportingText line, e.g. "10 days left". Requires supportingText; together at most 22 characters.'),
        caption: z.string().max(40).nullable(),
        tone,
      }),
      slots: [],
      description:
        "A headline with a progress bar under it. value is a fraction from 0 to 1. The bar repeats the headline unless the line under it adds something new, so give it a supportingText. The caption is available in the app details.",
      example: { label: "Left this month", value: 0.31, display: "$1,240", supportingText: "of $4,000", trailingText: "10 days left", caption: null, tone: "good" },
    },
    Ring: {
      props: z.strictObject({
        label: z.string().max(24),
        value: z.number().min(0).max(1).describe("How full the ring is, from 0 to 1."),
        display: z.string().max(5).nullable().optional().describe("Text in the middle of the ring. Omit to show the percentage."),
        supportingText: supportingText(40, 'What the ring is out of, e.g. "$9,300 of $15,000".'),
        tone,
      }),
      slots: [],
      description:
        "A ring that fills toward a goal, with the percentage in the middle. The quickest read of how full one thing is, but it spends the whole small widget on a single fraction. Prefer Progress when a second fact matters.",
      example: { label: "Emergency fund", value: 0.62, supportingText: "$9,300 of $15,000", tone: "accent" },
    },
    Trend: {
      props: z.strictObject({
        label: z.string().max(24).describe('Name the span the line covers, e.g. "Checking · 14 days".'),
        value: z.string().max(16).describe("The current value, formatted. It should match the last point."),
        points: z.array(z.number()).min(2).max(30).describe("Verified values, oldest to newest, evenly spaced in time. The last point is now."),
        goal: z.number().nullable().optional().describe("Draws a dashed goal line at this value, on the same scale as points."),
        supportingText: supportingText(40, "Optional context shown when there is room, always on medium."),
        tone,
      }),
      slots: [],
      description:
        "A headline value with a small line chart of how it got there. No axis is drawn, so it shows direction and shape, not readable values. Send only measured points; never draw a projection.",
      example: { label: "Checking · 14 days", value: "$4,218", points: [3100, 2904, 5350, 5010, 4650, 4218], tone: "accent" },
    },
    Columns: {
      props: z.strictObject({
        label: z.string().max(24),
        value: z.string().max(16).describe("The formatted value of the highlighted column."),
        supportingText: supportingText(40, "Optional context shown when there is room, always on medium."),
        columns: z
          .array(
            z.strictObject({
              label: z.string().min(1).max(2).describe('One or two characters under the column, e.g. "M".'),
              value: z.number().min(0).nullable().describe("Height of the column. null means it has not happened yet, which draws a stub instead of a zero."),
            }),
          )
          .min(2)
          .max(7),
        highlight: z.number().int().min(0).max(6).nullable().optional().describe("Zero-based index of the column the headline value belongs to, usually today."),
      }),
      slots: [],
      description:
        "A headline value above up to seven columns, such as the days of this week with today highlighted. Columns show relative size only. Use null for periods still to come.",
      example: {
        label: "Spent today",
        value: "$46",
        columns: [
          { label: "M", value: 64 },
          { label: "T", value: 121 },
          { label: "W", value: 46 },
          { label: "T", value: null },
        ],
        highlight: 2,
      },
    },
    BarList: {
      props: z.strictObject({
        label: z.string().max(24).nullable().describe("Heading for the list, including the time period. null when a headline before it already says so."),
        items: z
          .array(
            z.strictObject({
              label: z.string().min(1).max(16),
              value: z.string().min(1).max(12).describe('Formatted text at the right of the row, e.g. "$214 left".'),
              fraction: z.number().min(0).max(1).describe("Bar length from 0 to 1. Use one scale for every row."),
              tone: tone.describe("accent for a normal bar, warn or bad for one running hot, good for one on track, default for a quiet gray baseline such as last month."),
            }),
          )
          .min(2)
          .max(3),
        change: change.nullable().optional().describe("Optional change chip under the bars when comparing two periods."),
      }),
      slots: [],
      description:
        "Two or three labeled bars on one scale: a few budgets side by side, or this period against the last one. The bar that needs attention stands out by tone. A fourth row does not fit.",
      example: {
        label: "Budgets · November",
        items: [
          { label: "Groceries", value: "$214 left", fraction: 0.69, tone: "accent" },
          { label: "Dining out", value: "$82 left", fraction: 0.8, tone: "warn" },
        ],
      },
    },
    Split: {
      props: z.strictObject({
        label: z.string().max(24),
        value: z.string().max(16).describe("The formatted total."),
        segments: z
          .array(
            z.strictObject({
              label: z.string().min(1).max(12),
              value: z.string().min(1).max(10).describe('Formatted amount or share for the legend, e.g. "$883" or "32%".'),
              share: z.number().positive().describe("Relative size of the segment. Any positive numbers; the phone normalizes them."),
            }),
          )
          .min(2)
          .max(4),
      }),
      slots: [],
      description:
        "A total and what it is made of, as one segmented bar with a legend. Put the largest segment first and fold the remainder into a last segment such as Other. Small widgets show the first two legend rows; medium shows all.",
      example: {
        label: "Spent this month",
        value: "$2,760",
        segments: [
          { label: "Food", value: "$883", share: 32 },
          { label: "Kids", value: "$745", share: 27 },
          { label: "Other", value: "$1,132", share: 41 },
        ],
      },
    },
    Rows: {
      props: z.strictObject({
        label: z.string().max(24).nullable().describe("Heading for the list. null when a headline before it already says so."),
        marker: z
          .enum(["none", "dot", "icon"])
          .describe("none for plain figures. dot puts a colored status dot before each row. icon draws a check, exclamation or cross from the row's tone, which survives tinted Home Screens."),
        items: z
          .array(
            z.strictObject({
              label: z.string().min(1).max(16),
              value: z.string().max(16).describe("The figure or a word of status. With a marker, say what the marker cannot instead of repeating it."),
              detail: z.string().max(32).nullable().optional().describe("Extra words shown after the value only when the list has the full width of a medium widget."),
              tone,
            }),
          )
          .min(2)
          .max(4),
      }),
      slots: [],
      description:
        "A short list of related figures or statuses with equal weight, such as account balances or several agents. Nothing reads first, so use it only when no single number is the answer. Color only the row that needs attention.",
      example: {
        label: "Accounts",
        marker: "none",
        items: [
          { label: "Checking", value: "$4,218", tone: "default" },
          { label: "Credit card", value: "−$1,120", tone: "bad" },
        ],
      },
    },
    Agenda: {
      props: z.strictObject({
        label: z.string().max(24).describe('Which day or span, e.g. "Today" or "Later".'),
        items: z
          .array(
            z.strictObject({
              time: z.string().min(1).max(5).describe('Short start time, e.g. "3:30".'),
              text: z.string().min(1).max(24),
            }),
          )
          .min(1)
          .max(3),
      }),
      slots: [],
      description:
        "Up to three timed items for one day, in order. Filter to what actually needs the user; the Calendar widget already shows everything. Remove items once they have passed.",
      example: { label: "Today", items: [{ time: "3:30", text: "Pediatrician" }, { time: "5:30", text: "Soccer pickup" }] },
    },
    Dots: {
      props: z.strictObject({
        label: z.string().max(24),
        value: z.string().max(16).describe('The count so far, e.g. "3 of 5".'),
        days: z
          .array(
            z.strictObject({
              label: z.string().min(1).max(2).describe('One or two characters under the dot, e.g. "M".'),
              state: z.enum(["done", "missed", "today", "upcoming"]).describe("today is an open ring for a day still in play; mark it done once it happens."),
            }),
          )
          .min(2)
          .max(7),
        tone: tone.describe("Color of the done dots."),
      }),
      slots: [],
      description:
        "A week of did-or-didn't with a count, one dot per day. Missed days show without scolding. It needs a write each day, or today keeps looking open.",
      example: {
        label: "Workouts this week",
        value: "2 of 5",
        days: [
          { label: "M", state: "done" },
          { label: "T", state: "missed" },
          { label: "W", state: "done" },
          { label: "T", state: "today" },
          { label: "F", state: "upcoming" },
        ],
        tone: "good",
      },
    },
    Grid: {
      props: z.strictObject({
        label: z.string().max(24).describe('What a filled square means and for which month, e.g. "No-spend days · Oct".'),
        value: z.string().max(16).describe("The count of filled days."),
        supportingText: supportingText(40, "Optional context shown only when the grid has the full width of a medium widget."),
        offset: z.number().int().min(0).max(6).describe("Empty cells before the first day, so day one lands under its weekday. Oct 1 on a Thursday with Sunday-first weeks is 4."),
        days: z.array(z.boolean()).min(1).max(37).describe("One entry per day in order; true fills the square. offset plus days is at most 42."),
        tone: tone.describe("Color of the filled squares."),
      }),
      slots: [],
      description:
        "A month of yes-or-no days as a seven-column calendar grid. Density shows whether a habit is holding; single days cannot be picked out, so the label must say what a filled square means.",
      example: { label: "No-spend days · Oct", value: "3", offset: 4, days: [false, true, false, false, true, false, true], tone: "good" },
    },
    Checklist: {
      props: z.strictObject({
        label: z.string().max(24).describe("What the list is for. The phone adds how many are left."),
        items: z
          .array(z.strictObject({ text: z.string().min(1).max(24), done: z.boolean() }))
          .min(1)
          .max(6),
      }),
      slots: [],
      description:
        "Up to six things to do. The phone shows open items first and counts what is left, so do not put a count in the label. Small widgets show three items; medium shows six.",
      example: { label: "Before we go", items: [{ text: "Set thermostat", done: false }, { text: "Passports", done: true }] },
    },
    Steps: {
      props: z.strictObject({
        label: z.string().max(24).describe("The job being done."),
        steps: z.array(z.string().min(1).max(12)).min(2).max(6).describe("Stage names in order. The current one becomes the headline."),
        current: z.number().int().min(0).max(5).describe("Zero-based index of the stage running now."),
        supportingText: supportingText(24, 'Shown after the phone\'s own "Step 3 of 4", e.g. "14 min in".'),
      }),
      slots: [],
      description:
        "A job with known stages: the running stage as the headline, a segmented bar, and the step count. More honest than a percentage for agent work. When the job finishes, replace it with a Note whose status is done.",
      example: { label: "Pairing flow", steps: ["Plan", "Build", "Testing", "Ship"], current: 2, supportingText: "14 min in" },
    },
    Note: {
      props: z.strictObject({
        text: z.string().max(140),
        loud: z.boolean(),
        byline: z.string().max(24).nullable().optional().describe('Who the note is from and when, shown above it; e.g. "Jamie · 2:14 PM".'),
        status: z
          .enum(["done", "failed", "attention"])
          .nullable()
          .optional()
          .describe("Draws a check, cross or exclamation above the text. The icon already says the status, so the text must say what finished or what is needed."),
        supportingText: supportingText(60, "One quieter line under the text when there is room."),
      }),
      slots: [],
      description:
        "One brief thought, ideally under 55 characters. Put longer explanations in a later Note for the app. loud=true emphasizes reminders like \"DON'T FORGET!!\"; if everything is loud, nothing is.",
      example: { text: "Pick up the dry cleaning", loud: false },
    },
  },
});

export type WidgetSpec = typeof widgetCatalog._specType;
