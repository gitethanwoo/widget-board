import type { Spec } from "./catalog/spec.ts";

export type BoardElement = Spec["elements"][string];
export type BoardBlock = { id: string; element: BoardElement };

/**
 * Board and Row are the only components the catalog gives slots; everything else is a leaf.
 * Named here rather than read from the catalog so the browser bundle does not carry the
 * schema library. A test checks this against the catalog.
 */
function isLeaf(element: BoardElement) {
  return element.type !== "Board" && element.type !== "Row";
}

export function boardContent(spec: Spec) {
  const root = spec.elements[spec.root];
  const blocks: BoardBlock[] = [];
  const visited = new Set<string>();
  function visit(id: string, depth: number) {
    if (depth > 8 || visited.size >= 64 || visited.has(id)) return;
    visited.add(id);
    const element = spec.elements[id];
    if (!element) return;
    if (isLeaf(element)) blocks.push({ id, element });
    else for (const child of element.children) visit(child, depth + 1);
  }
  visit(spec.root, 0);
  const board = root?.type === "Board" ? root.props : null;
  return {
    title: board?.title ?? null,
    alert: board?.alert === true,
    showUpdated: board?.showUpdated === true,
    blocks,
  };
}

/** A small widget shows the first leaf; a medium widget adds at most the next two. */
export function widgetSummary(spec: Spec, size: "small" | "medium") {
  const content = boardContent(spec);
  return { ...content, blocks: content.blocks.slice(0, size === "small" ? 1 : 3) };
}
