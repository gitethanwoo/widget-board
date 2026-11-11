import type { ReactNode } from "react";
import type { BoardElement } from "../lib/board-content";
import { RowLine } from "./widget";
import { AgendaRow, Bar, BarRow, CheckRow, Chip, ColumnChart, DayGrid, DotsRow, Ends, Icon, RingChart, SplitBar, Spark, ink, percent, type Tone } from "./widget-parts";

/** One leaf in the "View all details" disclosure: everything the leaf holds, with nothing shortened to fit a widget. */

function Section({ label, value, tone = "default", children }: { label?: string | null; value?: string; tone?: Tone; children?: ReactNode }) {
  return <section className="wbd">
    {label && <p className="wbd-label">{label}</p>}
    {value && <p className={`wbd-value wb-t-${ink(tone)}`}>{value}</p>}
    {children}
  </section>;
}

function Text({ children }: { children: string | null | undefined }) {
  return children ? <p className="wbd-text">{children}</p> : null;
}

const STATUS = {
  done: { icon: <Icon kind="check" tone="good" size={22} />, word: "Done" },
  failed: { icon: <Icon kind="cross" tone="bad" size={22} />, word: "Failed" },
  attention: { icon: <Icon kind="bang" tone="warn" size={22} />, word: "Needs attention" },
};

/** Reaching this is a type error when the catalog gains a component the details do not show. */
function unhandled(element: never): null {
  void element;
  return null;
}

export function LeafDetails({ element }: { element: BoardElement }) {
  switch (element.type) {
    case "Board":
    case "Row": return null;
    case "Stat": {
      const { label, value, tone, change, supportingText, caption } = element.props;
      return <Section label={label} value={value} tone={tone}>
        {change && <Chip change={change} />}
        <Text>{supportingText}</Text>
        <Text>{caption}</Text>
      </Section>;
    }
    case "Progress": {
      const { label, value, display, marker, supportingText, trailingText, caption, tone } = element.props;
      return <Section label={label} value={display ?? percent(value)} tone={tone}>
        <Bar fraction={value} tone={ink(tone)} marker={marker} />
        {supportingText && trailingText ? <Ends start={supportingText} end={trailingText} /> : <Text>{supportingText}</Text>}
        <Text>{caption}</Text>
      </Section>;
    }
    case "Ring": {
      const { label, value, display, supportingText, tone } = element.props;
      return <Section label={label}>
        <RingChart fraction={value} size={78} tone={tone} inner={display ?? percent(value)} />
        <Text>{supportingText}</Text>
      </Section>;
    }
    case "Trend": {
      const { label, value, points, goal, supportingText, tone } = element.props;
      return <Section label={label} value={value}>
        <Spark points={points} width={280} height={goal != null ? 96 : 70} tone={tone} goal={goal} />
        <Text>{supportingText}</Text>
      </Section>;
    }
    case "Columns": {
      const { label, value, columns, highlight, supportingText } = element.props;
      return <Section label={label} value={value}>
        <ColumnChart columns={columns} highlight={highlight} height={92} />
        <Text>{supportingText}</Text>
      </Section>;
    }
    case "BarList": {
      const { label, items, change } = element.props;
      return <Section label={label}>
        {items.map((item, index) => <BarRow key={index} item={item} />)}
        {change && <Chip change={change} />}
      </Section>;
    }
    case "Split": {
      const { label, value, segments } = element.props;
      return <Section label={label} value={value}>
        <SplitBar segments={segments} />
        {segments.map((segment, index) => <p key={index} className="wb-row">
          <i className={`wb-swatch wb-c${index + 1}`} />
          <span className="wb-row-k">{segment.label}</span>
          <span className="wb-row-v">{segment.value}</span>
        </p>)}
      </Section>;
    }
    case "Rows": {
      const { label, marker, items } = element.props;
      return <Section label={label}>
        {items.map((item, index) => <RowLine key={index} item={item} marker={marker} detailed />)}
      </Section>;
    }
    case "Agenda": {
      const { label, items } = element.props;
      return <Section label={label}>
        {items.map((item, index) => <AgendaRow key={index} item={item} />)}
      </Section>;
    }
    case "Dots": {
      const { label, value, days, tone } = element.props;
      return <Section label={label} value={value}>
        <DotsRow days={days} tone={tone} />
      </Section>;
    }
    case "Grid": {
      const { label, value, supportingText, offset, days, tone } = element.props;
      return <Section label={label} value={value}>
        <DayGrid offset={offset} days={days} tone={tone} width={150} maxHeight={150} />
        <Text>{supportingText}</Text>
      </Section>;
    }
    case "Checklist": {
      const { label, items } = element.props;
      return <Section label={label}>
        <Text>{`${items.filter(item => item.done).length} of ${items.length} done`}</Text>
        {items.map((item, index) => <CheckRow key={index} item={item} />)}
      </Section>;
    }
    case "Steps": {
      const { label, steps, current, supportingText } = element.props;
      return <Section label={label} value={steps[current]}>
        {steps.map((step, index) => <p key={index} className="wb-row">
          {index < current ? <Icon kind="check" tone="good" size={16} /> : index === current ? <Icon kind="dot" tone="accent" size={16} /> : <Icon kind="ring" tone="mute" size={16} />}
          <span className="wb-row-k">{step}</span>
          {index === current && <span className="wb-row-v wb-row-v--soft">now</span>}
        </p>)}
        <Text>{`Step ${current + 1} of ${steps.length}${supportingText ? ` · ${supportingText}` : ""}`}</Text>
      </Section>;
    }
    case "Note": {
      const { text, loud, byline, status, supportingText } = element.props;
      return <Section label={byline}>
        {status && <p className="wbd-status">{STATUS[status].icon}<span>{STATUS[status].word}</span></p>}
        <p className={loud ? "wbd-note wbd-note--loud" : "wbd-note"}>{text}</p>
        <Text>{supportingText}</Text>
      </Section>;
    }
    default: return unhandled(element);
  }
}
