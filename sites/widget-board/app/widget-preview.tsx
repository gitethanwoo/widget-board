"use client";
import { useState } from "react";
import type { Board } from "../lib/boards";
import type { Spec } from "../lib/catalog/spec";
import { boardContent, widgetSummary } from "../lib/board-content";

type Element = Spec["elements"][string];
function Block({ element, detailed = false }: { element: Element; detailed?: boolean }) {
  switch (element.type) {
    case "Stat": return <div className={`glance-stat tone-${element.props.tone}`}>
      <p className="glance-label">{element.props.label}</p>
      <strong>{element.props.value}</strong>
      {element.props.supportingText && <p className="glance-context">{element.props.supportingText}</p>}
      {element.props.caption && detailed && <p className="glance-caption">{element.props.caption}</p>}
    </div>;
    case "Progress": return <div className={`glance-stat tone-${element.props.tone}`}>
      <p className="glance-label">{element.props.label}</p><strong>{Math.round(element.props.value * 100)}%</strong>
      <progress max={1} value={element.props.value} aria-label={element.props.label} />
      {element.props.caption && detailed && <p className="glance-caption">{element.props.caption}</p>}
    </div>;
    case "Note": return <p className={`glance-note${element.props.loud ? " loud" : ""}${detailed ? " full" : ""}`}>{element.props.text}</p>;
    default: return null;
  }
}

export function WidgetPreview({ board }: { board: Board }) {
  const [size, setSize] = useState<"small" | "medium">("small");
  const summary = widgetSummary(board.spec, size);
  const full = boardContent(board.spec);
  const [primary, ...supporting] = summary.blocks;
  return <article className="board-card">
    <div className="preview-sizes" role="group" aria-label="Widget size preview">
      {(["small", "medium"] as const).map(value => <button key={value} type="button" aria-pressed={size === value} onClick={() => setSize(value)}>{value === "small" ? "Small" : "Medium"}</button>)}
    </div>
    <div className="preview-stage">
      <div className={`glance-widget ${size}`} aria-label={`${size} widget preview`}>
        <div className="glance-body">
          <div className="glance-primary">{primary && <Block element={primary.element} />}</div>
          {supporting.length > 0 && <div className="glance-supporting">{supporting.map(block => <Block key={block.id} element={block.element} />)}</div>}
        </div>
      </div>
    </div>
    <details className="canvas-details"><summary>View all details</summary><div>{full.blocks.map(block => <Block key={block.id} element={block.element} detailed />)}<time dateTime={board.updatedAt}>Canvas saved {new Date(board.updatedAt).toLocaleString()}</time></div></details>
  </article>;
}
