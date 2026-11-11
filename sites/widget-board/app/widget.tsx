import type { ReactNode } from "react";
import { widgetSummary, type BoardElement } from "../lib/board-content";
import type { Spec } from "../lib/catalog/spec";
import {
  AgendaRow, Bar, BarRow, CheckRow, Chip, ColumnChart, DayGrid, DotsRow, Ends, Headline, Icon, Label, RingChart, SplitBar, Spark, StepBar, Sub, ToneIcon, Value,
  ink, percent, quiet, type Props,
} from "./widget-parts";

/**
 * The widget as the phone draws it, following docs/widget-design.md: a small widget is the first leaf in its
 * compact layout; a medium widget is that leaf beside up to two supporting leaves, or the leaf alone in its wide layout.
 */

type Layout = "compact" | "wide" | "supporting";
/** The room a leaf has, in points, after the widget's 16-point margins. */
type Space = { width: number; height: number };
type LeafProps<T extends BoardElement["type"]> = { props: Props<T>; layout: Layout; space: Space };

const SMALL = 126;
const COLUMN = 136;
const FULL = 306;
const HEIGHT = 126;
/** The updated footer's line plus the gap above it. */
const FOOTER = 19;
/** The height of a label over a headline value. */
const HEAD = { lg: 55, md: 47 };

/**
 * A column that shows only what fits: children that would overflow the height wrap into a second,
 * clipped column, so an optional last line or a list's last row is dropped instead of cut in half.
 */
function Fit({ children, loose = false }: { children: ReactNode; loose?: boolean }) {
  return <div className={loose ? "wb-fit wb-fit--loose" : "wb-fit"}>{children}</div>;
}

function Two({ left, right }: { left: ReactNode; right: ReactNode }) {
  return <div className="wb-two">{left}<hr className="wb-rule" />{right}</div>;
}

/** Words read better smaller than figures do: "Needs you" and "$51 over" are phrases, "21 days" and "3:30 PM" are figures. */
function headlineSize(value: string) {
  const text = value.trim();
  return /\s/.test(text) && !/^\d/.test(text) ? "md" : "lg";
}

function StatLeaf({ props, layout, space }: LeafProps<"Stat">) {
  if (layout === "supporting") return <Headline label={props.label} value={props.value} size="sm" tone={props.tone} width={space.width} />;
  return <Fit>
    <Headline label={props.label} value={props.value} size={headlineSize(props.value)} tone={props.tone} width={space.width}>
      {props.change && <Chip change={props.change} />}
    </Headline>
    {props.supportingText && <Sub>{props.supportingText}</Sub>}
  </Fit>;
}

function ProgressLeaf({ props, layout, space }: LeafProps<"Progress">) {
  const headline = props.display ?? percent(props.value);
  const bar = <Bar fraction={props.value} tone={ink(props.tone)} marker={props.marker} />;
  if (layout === "supporting") return <div className="wb-block">
    <Headline label={props.label} value={headline} size="sm" tone={props.tone} width={space.width} />
    {bar}
  </div>;
  return <Fit>
    <Headline label={props.label} value={headline} size={headlineSize(headline)} tone={props.tone} width={space.width} />
    {bar}
    {props.supportingText && (props.trailingText ? <Ends start={props.supportingText} end={props.trailingText} /> : <Sub>{props.supportingText}</Sub>)}
  </Fit>;
}

function RingLeaf({ props, layout, space }: LeafProps<"Ring">) {
  const inner = props.display ?? percent(props.value);
  if (layout === "supporting") return <Headline label={props.label} value={inner} size="sm" tone={props.tone} width={space.width} />;
  if (layout === "wide") return <Two
    left={<Fit><div className="wb-center"><RingChart fraction={props.value} size={Math.min(104, space.height)} tone={props.tone} inner={inner} /></div></Fit>}
    right={<Fit><div className="wb-stack"><Label>{props.label}</Label>{props.supportingText && <Sub>{props.supportingText}</Sub>}</div></Fit>}
  />;
  return <Fit>
    <RingChart fraction={props.value} size={78} tone={props.tone} inner={inner} />
    <Label>{props.label}</Label>
    {props.supportingText && <Sub tight>{props.supportingText}</Sub>}
  </Fit>;
}

function TrendLeaf({ props, layout, space }: LeafProps<"Trend">) {
  if (layout === "supporting") return <Headline label={props.label} value={props.value} size="sm" width={space.width} />;
  const hasGoal = props.goal != null;
  if (layout === "wide") return <Two
    left={<Fit><Headline label={props.label} value={props.value} size="lg" width={COLUMN} />{props.supportingText && <Sub>{props.supportingText}</Sub>}</Fit>}
    right={<Fit><Spark points={props.points} width={COLUMN} height={hasGoal ? 96 : 70} tone={props.tone} goal={props.goal} /></Fit>}
  />;
  /* A goal line needs headroom above the data, so the chart is taller and the value steps down a size. */
  const size = hasGoal ? "md" : "lg";
  return <Fit>
    <Headline label={props.label} value={props.value} size={size} width={space.width} />
    <Spark points={props.points} width={space.width} height={Math.min(hasGoal ? 56 : 44, space.height - HEAD[size] - 15)} tone={props.tone} goal={props.goal} />
    {props.supportingText && <Sub>{props.supportingText}</Sub>}
  </Fit>;
}

function ColumnsLeaf({ props, layout, space }: LeafProps<"Columns">) {
  if (layout === "supporting") return <Headline label={props.label} value={props.value} size="sm" width={space.width} />;
  if (layout === "wide") return <Two
    left={<Fit><Headline label={props.label} value={props.value} size="lg" width={COLUMN} />{props.supportingText && <Sub>{props.supportingText}</Sub>}</Fit>}
    right={<Fit><ColumnChart columns={props.columns} highlight={props.highlight} height={92} /></Fit>}
  />;
  return <Fit>
    <Headline label={props.label} value={props.value} size="md" width={space.width} />
    <ColumnChart columns={props.columns} highlight={props.highlight} height={Math.min(58, space.height - HEAD.md - 15)} />
    {props.supportingText && <Sub>{props.supportingText}</Sub>}
  </Fit>;
}

function BarListLeaf({ props, layout }: LeafProps<"BarList">) {
  const bars = props.items.map((item, index) => <BarRow key={index} item={item} />);
  if (layout === "supporting") return <div className="wb-block wb-block--loose">{bars}</div>;
  if (layout === "wide" && props.change) return <Two
    left={<Fit><div className="wb-stack">
      {props.label && <Label>{props.label}</Label>}
      <Value text={props.items[0].value} size="lg" width={COLUMN} />
      <Chip change={props.change} />
    </div></Fit>}
    right={<Fit loose>{bars}</Fit>}
  />;
  return <Fit>
    {props.label && <Label>{props.label}</Label>}
    {bars}
    {props.change && <Chip change={props.change} />}
  </Fit>;
}

function SplitLeaf({ props, layout, space }: LeafProps<"Split">) {
  if (layout === "supporting") return <Headline label={props.label} value={props.value} size="sm" width={space.width} />;
  const legend = props.segments.map((segment, index) => <p key={index} className={layout === "wide" ? "wb-row" : "wb-row wb-row--legend"}>
    <i className={`wb-swatch wb-c${index + 1}`} />
    <span className="wb-row-k">{segment.label}</span>
    <span className="wb-row-v">{segment.value}</span>
  </p>);
  if (layout === "wide") return <Two
    left={<Fit><Headline label={props.label} value={props.value} size="lg" width={COLUMN} /><SplitBar segments={props.segments} /></Fit>}
    right={<Fit>{legend}</Fit>}
  />;
  return <Fit>
    <Headline label={props.label} value={props.value} size="md" width={space.width} />
    <SplitBar segments={props.segments} />
    {legend.slice(0, 2)}
  </Fit>;
}

export function RowLine({ item, marker, detailed }: { item: Props<"Rows">["items"][number]; marker: Props<"Rows">["marker"]; detailed: boolean }) {
  /* Without a marker the value carries the tone. With one, the marker does, and only a warning also colors its value. */
  const urgent = item.tone === "warn" || item.tone === "bad";
  const value = marker === "none" ? `wb-row-v wb-t-${ink(item.tone)}` : urgent ? `wb-row-v wb-t-${item.tone}` : "wb-row-v wb-row-v--soft";
  return <p className={detailed ? "wb-row wb-row--list wb-row--wide" : "wb-row wb-row--list"}>
    {marker === "dot" && <i className={`wb-dot wb-bg-${quiet(item.tone)}`} />}
    {marker === "icon" && <ToneIcon tone={item.tone} size={16} />}
    <span className="wb-row-k">{item.label}</span>
    <span className={value}>{item.value}{detailed && item.detail && ` · ${item.detail}`}</span>
  </p>;
}

function RowsLeaf({ props, layout }: LeafProps<"Rows">) {
  const rows = <>
    {props.label && <Label>{props.label}</Label>}
    {props.items.map((item, index) => <RowLine key={index} item={item} marker={props.marker} detailed={layout === "wide"} />)}
  </>;
  return layout === "supporting" ? <div className="wb-block">{rows}</div> : <Fit>{rows}</Fit>;
}

function AgendaLeaf({ props, layout }: LeafProps<"Agenda">) {
  const rows = <>
    <Label>{props.label}</Label>
    {props.items.map((item, index) => <AgendaRow key={index} item={item} />)}
  </>;
  return layout === "supporting" ? <div className="wb-block">{rows}</div> : <Fit>{rows}</Fit>;
}

function DotsLeaf({ props, layout, space }: LeafProps<"Dots">) {
  if (layout === "supporting") return <div className="wb-stack wb-stack--dots"><Label>{props.label}</Label><DotsRow days={props.days} tone={props.tone} small /></div>;
  return <Fit>
    <Headline label={props.label} value={props.value} size="md" width={space.width} />
    <DotsRow days={props.days} tone={props.tone} />
  </Fit>;
}

function GridLeaf({ props, layout, space }: LeafProps<"Grid">) {
  if (layout === "supporting") return <Headline label={props.label} value={props.value} size="sm" width={space.width} />;
  if (layout === "wide") return <Two
    left={<Fit><Headline label={props.label} value={props.value} size="lg" width={COLUMN} />{props.supportingText && <Sub>{props.supportingText}</Sub>}</Fit>}
    right={<Fit><DayGrid offset={props.offset} days={props.days} tone={props.tone} width={COLUMN} maxHeight={HEIGHT} /></Fit>}
  />;
  return <Fit>
    <p className="wb-head"><span>{props.label}</span><b>{props.value}</b></p>
    <DayGrid offset={props.offset} days={props.days} tone={props.tone} width={space.width} maxHeight={space.height - 29} />
  </Fit>;
}

function ChecklistLeaf({ props, layout }: LeafProps<"Checklist">) {
  const open = props.items.filter(item => !item.done);
  const done = props.items.filter(item => item.done);
  const ordered = [...open, ...done].map((item, index) => <CheckRow key={index} item={item} />);
  if (layout === "supporting") {
    /* The label stays with the first item; the rest are separate so only the ones that fit are shown. */
    const [first, ...rest] = [...open, ...done];
    return <>
      <div className="wb-block"><Label>{props.label}</Label><CheckRow item={first} /></div>
      {rest.map((item, index) => <CheckRow key={index} item={item} className="wb-check--more" />)}
    </>;
  }
  if (layout === "wide" && props.items.length > 3) return <Two
    left={<Fit><Label>{props.label}</Label>{ordered.slice(0, 3)}</Fit>}
    right={<Fit><Label>{done.length} of {props.items.length} done</Label>{ordered.slice(3, 6)}</Fit>}
  />;
  return <Fit>
    <p className="wb-label wb-label--count"><span>{props.label}</span><span> · {open.length} left</span></p>
    {ordered.slice(0, 3)}
  </Fit>;
}

function StepsLeaf({ props, layout, space }: LeafProps<"Steps">) {
  const name = props.steps[props.current] ?? "";
  if (layout === "supporting") return <Headline label={props.label} value={name} size="sm" width={space.width} />;
  const width = layout === "wide" ? COLUMN : space.width;
  const compact = <Fit>
    <Headline label={props.label} value={name} size="md" width={width} />
    <StepBar count={props.steps.length} current={props.current} />
    <Sub>Step {props.current + 1} of {props.steps.length}{props.supportingText && ` · ${props.supportingText}`}</Sub>
  </Fit>;
  if (layout === "compact") return compact;
  const row = props.steps.length > 5 ? "wb-row wb-row--dense" : "wb-row";
  return <Two left={compact} right={<Fit>
    {props.steps.map((step, index) => <p key={index} className={row}>
      {index < props.current ? <Icon kind="check" tone="good" size={16} /> : index === props.current ? <Icon kind="dot" tone="accent" size={16} /> : <Icon kind="ring" tone="mute" size={16} />}
      <span className="wb-row-k">{step}</span>
      {index === props.current && <span className="wb-row-v wb-row-v--soft">now</span>}
    </p>)}
  </Fit>} />;
}

const STATUS_ICONS = {
  done: <Icon kind="check" tone="good" size={30} />,
  failed: <Icon kind="cross" tone="bad" size={30} />,
  attention: <Icon kind="bang" tone="warn" size={30} />,
};

function NoteLeaf({ props, layout, space }: LeafProps<"Note">) {
  if (layout === "supporting") return <p className="wb-note-sup">{props.text}</p>;
  /* The text is cut at the last whole line that fits beside the icon and byline. */
  const line = props.loud ? (layout === "wide" ? 27 : 21) * 1.14 : 16 * 1.22;
  const taken = (props.status ? 37 : 0) + (props.byline ? 22 : 0);
  const lines = Math.max(1, Math.floor((space.height - taken) / line));
  return <Fit>
    {props.status && STATUS_ICONS[props.status]}
    {props.byline && <Label>{props.byline}</Label>}
    <p className={`wb-note${props.loud ? " wb-note--loud" : ""}${props.loud && layout === "wide" ? " wb-note--wide" : ""}`} style={{ WebkitLineClamp: lines }}>{props.text}</p>
    {props.supportingText && <Sub>{props.supportingText}</Sub>}
  </Fit>;
}

/** Reaching this is a type error when the catalog gains a component no layout handles. */
function unhandled(element: never): null {
  void element;
  return null;
}

function Leaf({ element, layout, space }: { element: BoardElement; layout: Layout; space: Space }) {
  switch (element.type) {
    case "Board":
    case "Row": return null;
    case "Stat": return <StatLeaf props={element.props} layout={layout} space={space} />;
    case "Progress": return <ProgressLeaf props={element.props} layout={layout} space={space} />;
    case "Ring": return <RingLeaf props={element.props} layout={layout} space={space} />;
    case "Trend": return <TrendLeaf props={element.props} layout={layout} space={space} />;
    case "Columns": return <ColumnsLeaf props={element.props} layout={layout} space={space} />;
    case "BarList": return <BarListLeaf props={element.props} layout={layout} space={space} />;
    case "Split": return <SplitLeaf props={element.props} layout={layout} space={space} />;
    case "Rows": return <RowsLeaf props={element.props} layout={layout} space={space} />;
    case "Agenda": return <AgendaLeaf props={element.props} layout={layout} space={space} />;
    case "Dots": return <DotsLeaf props={element.props} layout={layout} space={space} />;
    case "Grid": return <GridLeaf props={element.props} layout={layout} space={space} />;
    case "Checklist": return <ChecklistLeaf props={element.props} layout={layout} space={space} />;
    case "Steps": return <StepsLeaf props={element.props} layout={layout} space={space} />;
    case "Note": return <NoteLeaf props={element.props} layout={layout} space={space} />;
    default: return unhandled(element);
  }
}

function savedTime(updatedAt: string) {
  return new Date(updatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function Widget({ spec, size, updatedAt }: { spec: Spec; size: "small" | "medium"; updatedAt: string }) {
  const { alert, showUpdated, blocks } = widgetSummary(spec, size);
  const [primary, ...supporting] = blocks;
  const medium = size === "medium";
  const paired = medium && supporting.length > 0;
  const space = { width: !medium ? SMALL : paired ? COLUMN : FULL, height: HEIGHT - (showUpdated ? FOOTER : 0) };
  const area = <div className={showUpdated ? "wb-area wb-area--foot" : "wb-area"}>
    {primary && <Leaf element={primary.element} layout={medium && !paired ? "wide" : "compact"} space={space} />}
    {showUpdated && <p className="wb-foot">Updated <time dateTime={updatedAt}>{savedTime(updatedAt)}</time></p>}
  </div>;
  return <div className={`wb${medium ? " wb--medium" : ""}${alert ? " wb--alert" : ""}`} role="group" aria-label={`${medium ? "Medium" : "Small"} widget preview`}>
    {paired
      ? <Two left={area} right={<Fit loose>{supporting.map(block => <Leaf key={block.id} element={block.element} layout="supporting" space={{ width: COLUMN, height: HEIGHT }} />)}</Fit>} />
      : area}
  </div>;
}
