// Quality check for the image escape hatch: draw a widget-sized card with
// json-render's image renderer (Satori), authored in points and rasterized
// at 3x, the density of current iPhones.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToSvg } from "@json-render/image/render";
import type { Spec } from "@json-render/core";
import { Resvg } from "@resvg/resvg-js";

const require = createRequire(import.meta.url);
const outDir = resolve(dirname(fileURLToPath(import.meta.url)), "../out");

async function font(weight: 400 | 600 | 700) {
  const path = require.resolve(`@fontsource/inter/files/inter-latin-${weight}-normal.woff`);
  return { name: "Inter", data: await readFile(path), weight, style: "normal" as const };
}

// systemSmall and systemMedium on a 393pt-wide iPhone.
const sizes = { small: { width: 158, height: 158 }, medium: { width: 338, height: 158 } };

function budgetCard(width: number, height: number, dark: boolean): Spec {
  const fg = dark ? "#ffffff" : "#111111";
  const dim = dark ? "#a0a0a8" : "#6b6b72";
  return {
    root: "frame",
    elements: {
      frame: {
        type: "Frame",
        props: { width, height, backgroundColor: dark ? "#1c1c1e" : "#ffffff" },
        children: ["col"],
      },
      col: {
        type: "Column",
        props: { gap: 2, padding: 16 },
        children: ["label", "value", "caption", "spacer", "barLabel", "track"],
      },
      label: { type: "Text", props: { text: "Left this month", fontSize: 11, color: dim, weight: "medium" }, children: [] },
      value: { type: "Text", props: { text: "$1,240", fontSize: 30, color: "#30a46c", weight: "bold" }, children: [] },
      caption: { type: "Text", props: { text: "of $4,000", fontSize: 11, color: dim }, children: [] },
      spacer: { type: "Spacer", props: { height: 14 }, children: [] },
      barLabel: { type: "Text", props: { text: "Dining out · $248 of $400", fontSize: 11, color: fg }, children: [] },
      track: {
        type: "Box",
        props: { backgroundColor: dark ? "#3a3a3c" : "#e5e5ea", borderRadius: 3, height: 6, width: width - 32, marginTop: 4 },
        children: ["fill"],
      },
      fill: {
        type: "Box",
        props: { backgroundColor: "#f5a524", borderRadius: 3, height: 6, width: Math.round((width - 32) * 0.62) },
        children: [],
      },
    },
  };
}

await mkdir(outDir, { recursive: true });
const fonts = [await font(400), await font(600), await font(700)];

for (const [family, { width, height }] of Object.entries(sizes)) {
  for (const dark of [false, true]) {
    const svg = await renderToSvg(budgetCard(width, height, dark), { fonts });
    const png = new Resvg(svg, { fitTo: { mode: "width", value: width * 3 } }).render().asPng();
    const file = resolve(outDir, `image-${family}-${dark ? "dark" : "light"}.png`);
    await writeFile(file, png);
    console.log(`${file}  svg=${svg.length}B png=${png.length}B`);
  }
}
