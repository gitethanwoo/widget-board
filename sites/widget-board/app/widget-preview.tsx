"use client";
import { useState } from "react";
import type { Board } from "../lib/boards";
import { boardContent } from "../lib/board-content";
import { Widget } from "./widget";
import { LeafDetails } from "./widget-details";

export function WidgetPreview({ board }: { board: Board }) {
  const [size, setSize] = useState<"small" | "medium">("small");
  const full = boardContent(board.spec);
  return <article className="board-card">
    <div className="preview-sizes" role="group" aria-label="Widget size preview">
      {(["small", "medium"] as const).map(value => <button key={value} type="button" aria-pressed={size === value} onClick={() => setSize(value)}>{value === "small" ? "Small" : "Medium"}</button>)}
    </div>
    <div className="preview-stage"><Widget spec={board.spec} size={size} updatedAt={board.updatedAt} /></div>
    <details className="canvas-details">
      <summary>View all details</summary>
      <div>
        {full.title && <p className="wbd-title">{full.title}</p>}
        {full.blocks.map(block => <LeafDetails key={block.id} element={block.element} />)}
        <time dateTime={board.updatedAt}>Canvas saved {new Date(board.updatedAt).toLocaleString()}</time>
      </div>
    </details>
  </article>;
}
