import type { Spec } from "./catalog/spec.ts";

/** Keep all data in the canvas; select a small, ordered summary for the widget. */
export function boardContent(spec: Spec) {
  const root = spec.elements[spec.root];
  const blocks: { id: string; element: Spec["elements"][string] }[] = [];
  const visited = new Set<string>();
  function visit(id: string, depth: number) {
    if (depth > 8 || visited.size >= 64 || visited.has(id)) return;
    visited.add(id);
    const element = spec.elements[id];
    if (!element) return;
    if (element.type === "Board" || element.type === "Row") {
      for (const child of element.children) visit(child, depth + 1);
    } else if (["Stat", "Progress", "Note"].includes(element.type)) blocks.push({ id, element });
  }
  visit(spec.root, 0);
  return { title: root?.type === "Board" ? root.props.title : null, blocks };
}

export function widgetSummary(spec: Spec, size: "small" | "medium") {
  const content = boardContent(spec);
  return { ...content, blocks: content.blocks.slice(0, size === "small" ? 1 : 3) };
}
