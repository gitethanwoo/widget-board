import type { ReactNode } from "react";
import type { BoardElement } from "../lib/board-content";

/** The drawing primitives of a widget: text roles, bars and the inline SVG charts. Class names are styled in globals.css under "Widget look". */

export type Props<T extends BoardElement["type"]> = Extract<BoardElement, { type: T }>["props"];
export type Tone = Props<"Stat">["tone"];
export type Change = NonNullable<Props<"Stat">["change"]>;
type Ink = "ink" | "accent" | "good" | "warn" | "bad" | "mute";

/** A default tone draws text in the ink color. */
export const ink = (tone: Tone): Ink => (tone === "default" ? "ink" : tone);
/** A default tone draws a marker or bar in quiet gray. */
export const quiet = (tone: Tone): Ink => (tone === "default" ? "mute" : tone);
export const percent = (fraction: number) => `${Math.round(fraction * 100)}%`;

/* Advance widths of SF Pro Rounded Semibold for ASCII 32 to 126, in hundredths of an em, measured in the browser. */
const ADVANCES = [
  20, 30, 44, 63, 63, 85, 69, 23, 36, 36, 44, 63, 27, 44, 27, 36,
  64, 47, 59, 62, 63, 61, 63, 56, 63, 63,
  27, 27, 63, 63, 63, 52, 88,
  67, 63, 70, 69, 57, 54, 72, 72, 25, 54, 64, 54, 85, 71, 74, 60, 74, 63, 62, 59, 70, 66, 95, 67, 65, 63,
  36, 36, 36, 44, 41, 49,
  53, 58, 53, 58, 54, 34, 58, 57, 23, 23, 52, 23, 84, 56, 56, 58, 58, 34, 50, 34, 56, 52, 76, 51, 53, 49,
  36, 36, 36, 63,
];
const VALUE_SIZES = { lg: 34, md: 26, sm: 19 };

/**
 * A headline value never wraps or truncates: like SwiftUI's minimumScaleFactor it shrinks, to 60% at most,
 * until the whole value fits. The width is estimated from the text so the size is known while rendering.
 */
function fittedSize(text: string, base: number, width: number) {
  let em = 0;
  for (const character of text) em += (ADVANCES[character.charCodeAt(0) - 32] ?? 75) / 100 - 0.01;
  const estimate = em * base * 1.03;
  if (estimate <= width) return base;
  return Math.max(base * 0.6, Math.floor((base * width * 10) / estimate) / 10);
}

export function Label({ children }: { children: ReactNode }) {
  return <p className="wb-label">{children}</p>;
}

export function Sub({ children, tight = false }: { children: ReactNode; tight?: boolean }) {
  return <p className={tight ? "wb-sub wb-sub--tight" : "wb-sub"}>{children}</p>;
}

export function Value({ text, size, tone = "default", width }: { text: string; size: keyof typeof VALUE_SIZES; tone?: Tone; width: number }) {
  const base = VALUE_SIZES[size];
  const fontSize = fittedSize(text, base, width);
  return <p className={`wb-value wb-value--${size} wb-t-${ink(tone)}`} style={fontSize === base ? undefined : { fontSize }}>{text}</p>;
}

/** A label over a headline value, with anything that belongs directly under the value. */
export function Headline({ label, value, size, tone, width, children }: { label: string; value: string; size: keyof typeof VALUE_SIZES; tone?: Tone; width: number; children?: ReactNode }) {
  return <div className="wb-stack">
    {label && <Label>{label}</Label>}
    <Value text={value} size={size} tone={tone} width={width} />
    {children}
  </div>;
}

/** One caption at each end of a line, used under a bar. */
export function Ends({ start, end }: { start: string; end: string }) {
  return <p className="wb-ends"><span>{start}</span><span>{end}</span></p>;
}

const ARROWS = { up: "↑", down: "↓", flat: "→" };
export function Chip({ change }: { change: Change }) {
  return <p className={`wb-chip wb-t-${change.sentiment}`}><span aria-hidden="true">{ARROWS[change.direction]}</span> {change.text}</p>;
}

export function Bar({ fraction, tone, marker }: { fraction: number; tone: Ink; marker?: number | null }) {
  return <div className="wb-bar">
    <i className={`wb-bg-${tone}`} style={{ width: percent(fraction) }} />
    {marker != null && <b style={{ left: `calc(1px + (100% - 2px) * ${marker})` }} />}
  </div>;
}

export function BarRow({ item }: { item: Props<"BarList">["items"][number] }) {
  return <div className="wb-hbar">
    <p><span>{item.label}</span><span>{item.value}</span></p>
    <Bar fraction={item.fraction} tone={quiet(item.tone)} />
  </div>;
}

type IconKind = "check" | "cross" | "bang" | "dot" | "ring";
const ICON_PATHS: Record<Exclude<IconKind, "ring">, ReactNode> = {
  check: <path d="M7 12.5l3.5 3.5L17 8.5" />,
  cross: <path d="M8 8l8 8M16 8l-8 8" />,
  bang: <path d="M12 7v6.5M12 17v.01" />,
  dot: <circle cx="12" cy="12" r="3.2" fill="currentColor" stroke="none" />,
};
export function Icon({ kind, tone, size }: { kind: IconKind; tone: Ink; size: number }) {
  return <span className={`wb-icon wb-t-${tone}${kind === "ring" ? " wb-icon--hollow" : ""}`} style={{ width: size, height: size }} aria-hidden="true">
    {kind !== "ring" && <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">{ICON_PATHS[kind]}</svg>}
  </span>;
}

/** The icon a tone stands for in a list: good is a check, warn an exclamation, bad a cross, accent a filled dot, default a hollow ring. */
export function ToneIcon({ tone, size }: { tone: Tone; size: number }) {
  const kinds: Record<Tone, IconKind> = { good: "check", warn: "bang", bad: "cross", accent: "dot", default: "ring" };
  return <Icon kind={kinds[tone]} tone={quiet(tone)} size={size} />;
}

export function CheckRow({ item, className = "" }: { item: Props<"Checklist">["items"][number]; className?: string }) {
  return <p className={`wb-check${item.done ? " wb-check--done" : ""}${className && ` ${className}`}`}>
    {item.done ? <Icon kind="check" tone="good" size={16} /> : <Icon kind="ring" tone="mute" size={16} />}
    <span>{item.text}</span>
  </p>;
}

export function AgendaRow({ item }: { item: Props<"Agenda">["items"][number] }) {
  return <p className="wb-agenda"><span className="wb-agenda-time">{item.time}</span><span>{item.text}</span></p>;
}

export function DotsRow({ days, tone, small = false }: { days: Props<"Dots">["days"]; tone: Tone; small?: boolean }) {
  return <div className={small ? "wb-dots wb-dots--sm" : "wb-dots"}>
    {days.map((day, index) => <span key={index}>
      <i className={day.state === "done" ? `wb-bg-${ink(tone)}` : day.state === "today" ? "wb-dots-today" : undefined} />
      {!small && <em>{day.label}</em>}
    </span>)}
  </div>;
}

export function ColumnChart({ columns, highlight, height }: { columns: Props<"Columns">["columns"]; highlight?: number | null; height: number }) {
  const max = Math.max(...columns.map(column => column.value ?? 0)) || 1;
  return <div className="wb-cols" style={{ height }} aria-hidden="true">
    {columns.map((column, index) => <span key={index}>
      <b>{column.value == null
        ? <i className="wb-cols-nil" />
        : <i className={index === highlight ? "wb-bg-accent" : undefined} style={{ height: `${Math.max(6, Math.round((column.value / max) * 100))}%` }} />}</b>
      <em>{column.label}</em>
    </span>)}
  </div>;
}

export function StepBar({ count, current }: { count: number; current: number }) {
  return <div className="wb-steps" aria-hidden="true">
    {Array.from({ length: count }, (_, index) => <i key={index} className={index < current ? "wb-steps-done" : index === current ? "wb-steps-current" : undefined} />)}
  </div>;
}

export function SplitBar({ segments }: { segments: Props<"Split">["segments"] }) {
  return <div className="wb-split" aria-hidden="true">
    {segments.map((segment, index) => <i key={index} className={`wb-c${index + 1}`} style={{ flexGrow: segment.share }} />)}
  </div>;
}

/** A month of yes-or-no days. The squares fill the width unless that would make the grid taller than maxHeight. */
export function DayGrid({ offset, days, tone, width, maxHeight }: { offset: number; days: boolean[]; tone: Tone; width: number; maxHeight: number }) {
  const gap = 3;
  const rows = Math.ceil((offset + days.length) / 7);
  const cell = Math.floor(Math.min((width - 6 * gap) / 7, (maxHeight - (rows - 1) * gap) / rows) * 100) / 100;
  return <div className="wb-grid" style={{ gridTemplateColumns: `repeat(7, ${cell}px)`, gridAutoRows: `${cell}px` }} aria-hidden="true">
    {Array.from({ length: offset }, (_, index) => <i key={`blank-${index}`} className="wb-grid-blank" />)}
    {days.map((filled, index) => <i key={index} className={filled ? `wb-bg-${ink(tone)}` : undefined} />)}
  </div>;
}

export function RingChart({ fraction, size, tone, inner }: { fraction: number; size: number; tone: Tone; inner: string }) {
  const stroke = 9;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;
  return <div className="wb-ring" style={{ width: size, height: size }}>
    <svg className={`wb-t-${ink(tone)}`} width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={center} cy={center} r={radius} fill="none" stroke="var(--w-fill)" strokeWidth={stroke} />
      <circle cx={center} cy={center} r={radius} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={`${(circumference * fraction).toFixed(1)} ${circumference.toFixed(1)}`} transform={`rotate(-90 ${center} ${center})`} />
    </svg>
    <span>{inner}</span>
  </div>;
}

/** A line chart with no axis: a 2-point line, a faint area under it and a dot on the last point. A goal adds a dashed line. */
export function Spark({ points, width, height, tone, goal }: { points: number[]; width: number; height: number; tone: Tone; goal?: number | null }) {
  const pad = 4;
  const top = goal != null ? 14 : pad;
  const low = Math.min(...points);
  const high = Math.max(...points, ...(goal != null ? [goal] : []));
  const x = (index: number) => pad + (index * (width - 2 * pad)) / (points.length - 1);
  /* A line with no range sits in the middle of the chart instead of on its floor. */
  const y = (value: number) => high === low ? (height - pad + top) / 2 : height - pad - ((value - low) * (height - pad - top)) / (high - low);
  const line = points.map((value, index) => `${x(index).toFixed(1)},${y(value).toFixed(1)}`).join(" ");
  const last = points.length - 1;
  return <svg className={`wb-spark wb-t-${ink(tone)}`} style={{ width, height }} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
    {goal != null && <>
      <line x1={0} x2={width} y1={y(goal).toFixed(1)} y2={y(goal).toFixed(1)} stroke="var(--w-sec)" strokeWidth="1.5" strokeDasharray="3 3" />
      <text x={width} y={(y(goal) - 4).toFixed(1)} textAnchor="end" fontSize="9" fill="var(--w-sec)">Goal</text>
    </>}
    <polygon points={`${x(0).toFixed(1)},${height - pad} ${line} ${x(last).toFixed(1)},${height - pad}`} fill="currentColor" opacity=".13" />
    <polyline points={line} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    <circle cx={x(last).toFixed(1)} cy={y(points[last]).toFixed(1)} r="3.5" fill="currentColor" stroke="var(--w-bg)" strokeWidth="2" />
  </svg>;
}
