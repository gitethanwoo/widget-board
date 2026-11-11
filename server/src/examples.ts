import type { Spec } from "./spec.js";

/**
 * The approved board designs, as complete specs. They are what get_examples
 * returns to agents, the fixtures the renderers are drawn and tested against,
 * and the proof that every component in the catalog has a worked use.
 *
 * All figures are made-up sample data.
 */
export type Example = {
  id: string;
  name: string;
  /** The kind of question this design answers at a glance. */
  question: string;
  useWhen: string;
  avoidWhen: string;
  spec: Spec;
};

type Elements = Spec["elements"];
type Leaf = Elements[string];

const stat = (label: string, value: string, tone: "default" | "accent" | "good" | "warn" | "bad" = "default", supportingText?: string): Leaf => ({
  type: "Stat",
  props: { label, value, ...(supportingText ? { supportingText } : {}), caption: null, tone },
  children: [],
});

/** A board whose leaves appear in the order given: the first is the small widget. */
function board(leaves: Record<string, Leaf>, props: { alert?: boolean; showUpdated?: boolean } = {}): Spec {
  return {
    root: "board",
    elements: { board: { type: "Board", props: { title: null, ...props }, children: Object.keys(leaves) }, ...leaves },
  };
}

const week = (states: ("done" | "missed" | "today" | "upcoming")[]) => states.map((state, i) => ({ label: "MTWTFSS"[i] ?? "", state }));

export const examples: Example[] = [
  {
    id: "number-comparison",
    name: "Number with a comparison",
    question: "How much did we spend this week?",
    useWhen: "One number answers the question and a short comparison says whether it is good or bad.",
    avoidWhen: "The comparison is vague or unverified. A number with no context is better than an invented one.",
    spec: board({
      week: stat("This week", "$312.50", "accent", "Down 18% from last week"),
      groceries: stat("Groceries", "$142.10"),
      dining: stat("Dining out", "$86.40"),
    }),
  },
  {
    id: "number-delta",
    name: "Number with a change chip",
    question: "Is this week better or worse than last?",
    useWhen: "The direction and size of a change are the point. The chip's color carries good or bad so the number stays neutral.",
    avoidWhen: "You cannot say whether the change is good news. Lower spending is good; lower savings is not.",
    spec: board({
      week: {
        type: "Stat",
        props: { label: "This week", value: "$312.50", change: { direction: "down", text: "18% vs last week", sentiment: "good" }, caption: null, tone: "default" },
        children: [],
      },
      last: stat("Last week", "$381.20"),
      average: stat("4-week average", "$356.00"),
    }),
  },
  {
    id: "number-sparkline",
    name: "Number with a sparkline",
    question: "What's in checking, and how has it moved?",
    useWhen: "The shape behind the number matters, such as a payday jump and the slow drain after it.",
    avoidWhen: "You have fewer than a handful of real measurements, or the user needs to read exact past values. There is no axis.",
    spec: board({
      checking: {
        type: "Trend",
        props: {
          label: "Checking · 14 days",
          value: "$4,218",
          points: [3100, 3050, 2980, 2904, 5350, 5200, 5010, 4890, 4700, 4650, 4480, 4400, 4290, 4218],
          supportingText: "Low of $2,904 on Oct 30",
          tone: "accent",
        },
        children: [],
      },
    }),
  },
  {
    id: "remaining-bar",
    name: "What's left, with a bar",
    question: "Will the money last the month?",
    useWhen: "An amount left, what it is out of, and the time remaining together answer whether it will last.",
    avoidWhen: "The line under the bar would only repeat the headline. Then a plain Stat says the same in less space.",
    spec: board({
      left: {
        type: "Progress",
        props: { label: "Left this month", value: 0.31, display: "$1,240", supportingText: "of $4,000", trailingText: "10 days left", caption: null, tone: "good" },
        children: [],
      },
      budgets: {
        type: "BarList",
        props: {
          label: null,
          items: [
            { label: "Groceries", value: "$214 left", fraction: 0.69, tone: "accent" },
            { label: "Dining out", value: "$82 left", fraction: 0.8, tone: "warn" },
          ],
        },
        children: [],
      },
    }),
  },
  {
    id: "budget-pace",
    name: "Ahead or behind pace",
    question: "Are we spending faster than the month allows?",
    useWhen: "The real question is ahead or behind, not how much is gone. The marker shows where an even pace would be today.",
    avoidWhen: "Spending is lumpy, such as one big bill early in the month. An even-pace marker would cry wolf.",
    spec: board({
      dining: {
        type: "Progress",
        props: { label: "Dining out · Nov", value: 0.795, display: "$51 over", marker: 0.667, supportingText: "Day 20 of 30. The mark shows even pace.", caption: null, tone: "warn" },
        children: [],
      },
      spent: stat("Spent", "$318 of $400"),
      pace: stat("Even pace", "$267"),
    }),
  },
  {
    id: "ring",
    name: "Ring",
    question: "How full is the emergency fund?",
    useWhen: "One fraction of a goal is the whole story and should read instantly.",
    avoidWhen: "A second fact matters at a glance. A ring spends the whole small widget on one percentage; Progress leaves room.",
    spec: board({
      fund: { type: "Ring", props: { label: "Emergency fund", value: 0.62, supportingText: "$9,300 of $15,000", tone: "accent" }, children: [] },
      detail: {
        type: "Rows",
        props: {
          label: null,
          marker: "none",
          items: [
            { label: "Saved", value: "$9,300", tone: "default" },
            { label: "To go", value: "$5,700", tone: "default" },
            { label: "At this rate", value: "June", tone: "default" },
          ],
        },
        children: [],
      },
    }),
  },
  {
    id: "category-bars",
    name: "Category bars",
    question: "Which budgets are running hot?",
    useWhen: "Two or three budgets need comparing at once and the one running hot should stand out.",
    avoidWhen: "There are more than three categories, or one total is the real answer.",
    spec: board({
      budgets: {
        type: "BarList",
        props: {
          label: "Budgets · November",
          items: [
            { label: "Groceries", value: "$214 left", fraction: 0.69, tone: "accent" },
            { label: "Dining out", value: "$82 left", fraction: 0.8, tone: "warn" },
            { label: "Gas", value: "$148 left", fraction: 0.38, tone: "accent" },
          ],
        },
        children: [],
      },
    }),
  },
  {
    id: "split-bar",
    name: "Where it went",
    question: "What is the month's spending made of?",
    useWhen: "The user asks how a total divides and two to four parts cover it.",
    avoidWhen: "There are many small parts, or the parts do not add up to the total shown.",
    spec: board({
      spent: {
        type: "Split",
        props: {
          label: "Spent this month",
          value: "$2,760",
          segments: [
            { label: "Food", value: "$883", share: 32 },
            { label: "Kids", value: "$745", share: 27 },
            { label: "Car", value: "$497", share: 18 },
            { label: "Other", value: "$635", share: 23 },
          ],
        },
        children: [],
      },
    }),
  },
  {
    id: "week-bars",
    name: "The week in bars",
    question: "How does today compare with the rest of the week?",
    useWhen: "Today's figure means more next to the other days, so an unusual day is obvious.",
    avoidWhen: "You only have today's figure. Never fill in other days to make the chart look complete.",
    spec: board({
      today: {
        type: "Columns",
        props: {
          label: "Spent today",
          value: "$46",
          supportingText: "Week so far $312.50",
          columns: [
            { label: "M", value: 64 },
            { label: "T", value: 121 },
            { label: "W", value: 81.5 },
            { label: "T", value: 46 },
            { label: "F", value: null },
            { label: "S", value: null },
            { label: "S", value: null },
          ],
          highlight: 3,
        },
        children: [],
      },
    }),
  },
  {
    id: "rows",
    name: "Short list of figures",
    question: "What's in each account?",
    useWhen: "A few related figures carry equal weight and no single one is the answer.",
    avoidWhen: "One total would answer the question. With no headline nothing reads first, and it is the smallest text on the board.",
    spec: board({
      accounts: {
        type: "Rows",
        props: {
          label: "Accounts",
          marker: "none",
          items: [
            { label: "Checking", value: "$4,218", tone: "default" },
            { label: "Savings", value: "$9,300", tone: "default" },
            { label: "Credit card", value: "−$1,120", tone: "bad" },
          ],
        },
        children: [],
      },
    }),
  },
  {
    id: "countdown",
    name: "Countdown",
    question: "How long until rent is due?",
    useWhen: "One upcoming date matters and how far away it is.",
    avoidWhen: "Nothing will update the board tomorrow. The text does not count down by itself, so a stale count is wrong.",
    spec: board({
      rent: stat("Rent due", "21 days", "default", "Dec 1 · $2,150"),
      daycare: stat("Daycare", "3 days", "warn"),
      insurance: stat("Car insurance", "19 days"),
    }),
  },
  {
    id: "next-up",
    name: "Next up",
    question: "What's next, and when do I leave?",
    useWhen: "The next event and when to leave for it are what the user needs.",
    avoidWhen: "Nothing will update the board once the event passes.",
    spec: board({
      next: stat("Next", "3:30 PM", "default", "Pediatrician. Leave by 2:50."),
      later: {
        type: "Agenda",
        props: { label: "Later", items: [{ time: "5:30", text: "Soccer pickup" }, { time: "7:00", text: "Dinner out" }] },
        children: [],
      },
    }),
  },
  {
    id: "agenda",
    name: "Agenda",
    question: "What does today hold?",
    useWhen: "The day comes down to two or three things that actually need the user.",
    avoidWhen: "You would list every calendar event. The Calendar widget already does that better.",
    spec: board({
      today: {
        type: "Agenda",
        props: { label: "Today", items: [{ time: "3:30", text: "Pediatrician" }, { time: "5:30", text: "Soccer pickup" }, { time: "7:00", text: "Dinner out" }] },
        children: [],
      },
      tomorrow: {
        type: "Agenda",
        props: { label: "Tomorrow", items: [{ time: "8:00", text: "Car to the shop" }, { time: "12:15", text: "Team lunch" }, { time: "6:00", text: "School concert" }] },
        children: [],
      },
    }),
  },
  {
    id: "habit-week",
    name: "Habit week",
    question: "Did I keep it up this week?",
    useWhen: "A daily did-or-didn't habit is tracked across one week with a target count.",
    avoidWhen: "The board will not be written every day. Without a daily write, today keeps looking open.",
    spec: board({
      workouts: { type: "Dots", props: { label: "Workouts this week", value: "3 of 5", days: week(["done", "missed", "done", "today", "upcoming", "upcoming", "upcoming"]), tone: "good" }, children: [] },
      reading: { type: "Dots", props: { label: "Reading", value: "3 days", days: week(["done", "done", "done", "today", "upcoming", "upcoming", "upcoming"]), tone: "accent" }, children: [] },
      bedtime: { type: "Dots", props: { label: "In bed by 11", value: "1 night", days: week(["missed", "done", "missed", "today", "upcoming", "upcoming", "upcoming"]), tone: "accent" }, children: [] },
    }),
  },
  {
    id: "month-grid",
    name: "Month grid",
    question: "How many no-spend days last month?",
    useWhen: "A month of yes-or-no days should show its density at once, to see whether a habit is holding.",
    avoidWhen: "Individual days matter, or you do not have a verified answer for every day shown.",
    spec: board({
      nospend: {
        type: "Grid",
        props: {
          label: "No-spend days · Oct",
          value: "11",
          supportingText: "Best month this year.",
          offset: 4,
          // prettier-ignore
          days: [
            false, true, false,
            false, true, false, false, true, false, false,
            true, false, false, true, true, false, false,
            false, false, true, false, true, false, true,
            false, true, false, false, true, false, false,
          ],
          tone: "good",
        },
        children: [],
      },
    }),
  },
  {
    id: "loud-reminder",
    name: "Loud reminder",
    question: "What must I not forget tonight?",
    useWhen: "There is exactly one thing the user must not forget, and it matters today.",
    avoidWhen: "It is not urgent, or the last board was loud too. Replace it once the moment has passed.",
    spec: board({
      trash: { type: "Note", props: { text: "Trash goes out tonight", loud: true, supportingText: "Recycling too. Bins at the curb by 7 AM." }, children: [] },
    }),
  },
  {
    id: "note-from",
    name: "Note from a person",
    question: "What did they ask me?",
    useWhen: "A person left a message, and who wrote it and when changes what it means.",
    avoidWhen: "You do not know who sent it or when. Never guess a byline.",
    spec: board({
      note: { type: "Note", props: { text: "Can you grab milk on the way home?", loud: false, byline: "Jamie · 2:14 PM" }, children: [] },
    }),
  },
  {
    id: "checklist",
    name: "Checklist",
    question: "What's left before we go?",
    useWhen: "There are up to six concrete things to do and the user needs to see what is left.",
    avoidWhen: "The list is longer than six, or nothing will mark items done as they happen.",
    spec: board({
      leaving: {
        type: "Checklist",
        props: {
          label: "Before we go",
          items: [
            { text: "Set thermostat", done: false },
            { text: "Trash out", done: false },
            { text: "Passports", done: true },
            { text: "Dog to the kennel", done: true },
            { text: "Hold the mail", done: true },
            { text: "Water the plants", done: true },
          ],
        },
        children: [],
      },
    }),
  },
  {
    id: "answer",
    name: "A question and its answer",
    question: "Can we afford the Denver trip?",
    useWhen: "The user asked a yes-or-no question and you can back the answer with one verified reason.",
    avoidWhen: "The answer depends on assumptions the user has not seen. Put them in a later Note so they are one tap away.",
    spec: board({
      denver: stat("Can we do Denver?", "Yes", "good", "$640 to spare after flights and hotel"),
      flights: stat("Flights", "$412"),
      hotel: stat("Hotel, 3 nights", "$520"),
    }),
  },
  {
    id: "agent-progress",
    name: "Progress bar",
    question: "How far along is the refactor?",
    useWhen: "A long-running job has a measurable fraction complete, and a line that says what it is doing now.",
    avoidWhen: "The percentage would be a guess. If the job has known stages, Steps is more honest.",
    spec: board({
      refactor: {
        type: "Progress",
        props: { label: "Refactor auth", value: 0.72, supportingText: "Step 5 of 7 · running tests", caption: null, tone: "accent" },
        children: [],
      },
      running: stat("Running for", "14 min"),
      files: stat("Files changed", "23"),
    }),
  },
  {
    id: "steps",
    name: "Step tracker",
    question: "Which stage is it on?",
    useWhen: "A job has a plan of two to six known stages. The user sees what is done and what is running.",
    avoidWhen: "The plan is not known up front, or the job has finished. For a finished job use a Note with status done.",
    spec: board({
      pairing: { type: "Steps", props: { label: "Pairing flow", steps: ["Plan", "Build", "Testing", "Ship"], current: 2, supportingText: "14 min in" }, children: [] },
    }),
  },
  {
    id: "agents",
    name: "Several agents",
    question: "What are all my agents doing?",
    useWhen: "Several jobs run at once and each needs a word of status. Only the row that needs the user is in color.",
    avoidWhen: "There are more than four. Show a count and the one that needs attention instead.",
    spec: board({
      agents: {
        type: "Rows",
        props: {
          label: "Agents",
          marker: "dot",
          items: [
            { label: "Deploy", value: "Needs you", detail: "approve the migration", tone: "warn" },
            { label: "Refactor", value: "12 min", detail: "running tests", tone: "accent" },
            { label: "Docs", value: "Done", detail: "ready to review", tone: "good" },
          ],
        },
        children: [],
      },
    }),
  },
  {
    id: "outcome",
    name: "Finished",
    question: "Did it work?",
    useWhen: "A job finished. The check says it is done, so the words say what finished and what happens next.",
    avoidWhen: "It has been sitting there for days. Clear a finished notice once the user has seen it.",
    spec: board({
      result: { type: "Note", props: { text: "Auth refactor is ready to review", loud: false, status: "done", supportingText: "148 tests pass" }, children: [] },
      tests: stat("Tests", "148 pass"),
      took: stat("Took", "26 min"),
    }),
  },
  {
    id: "needs-you",
    name: "Needs you",
    question: "Is something waiting on me?",
    useWhen: "Work is blocked until the user acts. The orange widget is the one signal visible from across the room.",
    avoidWhen: "Nothing is blocked. Used routinely the color stops meaning anything; set alert back to false once the user has acted.",
    spec: board(
      {
        deploy: stat("Deploy agent", "Needs you", "default", "Approve the migration to continue."),
        waiting: stat("Waiting", "6 min"),
        blocked: stat("Blocked step", "4 of 6"),
      },
      { alert: true },
    ),
  },
  {
    id: "all-clear",
    name: "All clear",
    question: "Does anything need me today?",
    useWhen: "You checked and nothing needs the user. Most days that is the right amount of information.",
    avoidWhen: "You have not actually checked. Always set showUpdated, so an agent that stopped running does not look like good news.",
    spec: board(
      {
        status: stat("", "All clear", "good", "No bills due this week"),
        checks: {
          type: "Rows",
          props: {
            label: null,
            marker: "icon",
            items: [
              { label: "Balances", value: "Normal", tone: "good" },
              { label: "Renewals", value: "None", tone: "good" },
              { label: "Cards", value: "Paid", tone: "good" },
            ],
          },
          children: [],
        },
      },
      { showUpdated: true },
    ),
  },
  {
    id: "threshold",
    name: "Line crossed",
    question: "Is an account about to cause a problem?",
    useWhen: "A figure crossed a line the user cares about. Pair the number with the reason it matters.",
    avoidWhen: "It is routine. Red loses meaning when used for ordinary things; replace the board once the problem is resolved.",
    spec: board({
      checking: stat("Checking is low", "$312", "bad", "Rent of $2,150 is due in 3 days"),
      savings: stat("Savings", "$9,300"),
      short: stat("Short by", "$1,838", "bad"),
    }),
  },
  {
    id: "compare",
    name: "This period against last",
    question: "Are groceries up or down on last month?",
    useWhen: "Two periods are compared on one scale, so the difference shows before either number is read.",
    avoidWhen: "The periods are not like for like. Compare the same number of days, and say so in the label.",
    spec: board({
      groceries: {
        type: "BarList",
        props: {
          label: "Groceries to day 20",
          items: [
            { label: "November", value: "$486", fraction: 0.79, tone: "accent" },
            { label: "October", value: "$612", fraction: 1, tone: "default" },
          ],
          change: { direction: "down", text: "21% vs October", sentiment: "good" },
        },
        children: [],
      },
    }),
  },
  {
    id: "goal-line",
    name: "Progress toward a goal",
    question: "Are we getting closer to the savings goal?",
    useWhen: "Progress over time and the distance still to go belong in one picture.",
    avoidWhen: "You would need to forecast. Draw only measured points; the goal line is not a projection.",
    spec: board({
      fund: {
        type: "Trend",
        props: {
          label: "Emergency fund",
          value: "$9,300",
          points: [6200, 6600, 7000, 7400, 7900, 8300, 8800, 9300],
          goal: 15000,
          supportingText: "Goal is $15,000. Up $3,100 since April.",
          tone: "accent",
        },
        children: [],
      },
    }),
  },
];

const preamble = [
  "Approved board designs. Find the one whose question matches what the user is asking, then replace the sample data with verified data.",
  "Use verified data only. Never invent an amount, percentage, chart point or freshness claim. Every figure below is made-up sample data.",
  "The first leaf in a spec is the whole small widget. Later leaves appear only beside it on a medium widget and are optional: drop them unless the user needs them at a glance.",
  "If nothing here fits, a single Stat or Note is almost always right.",
].join("\n");

/** What get_examples returns: how to choose, then every design with a complete valid spec. */
export function examplesReference() {
  return { guidance: preamble, examples };
}

/** Example ids that use a component, so a rejected spec can point at a working one. */
export function examplesUsing(type: string): string[] {
  return examples.filter((example) => Object.values(example.spec.elements).some((element) => element.type === type)).map((example) => example.id);
}
