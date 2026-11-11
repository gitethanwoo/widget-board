import { readFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

// server/src is the source of truth for the component contract. The site
// imports generated copies, and the iOS tests draw the same example specs.
// Run with Node 22.18 or later, which can import the generated TypeScript.
const root = new URL("../", import.meta.url);
const destination = new URL("sites/widget-board/lib/catalog/", root);
await mkdir(destination, { recursive: true });
for (const name of ["catalog", "spec", "examples"]) {
  const source = await readFile(new URL(`server/src/${name}.ts`, root), "utf8");
  await writeFile(new URL(`${name}.ts`, destination),
    "// Generated from server/src; run node scripts/sync-sites-catalog.mjs from the repository root.\n" +
    source.replace(/"\.\/(catalog|spec)\.js"/g, '"./$1.ts"'));
}
console.log(`Synced widget catalog to ${fileURLToPath(destination)}`);

const { examples } = await import(new URL("examples.ts", destination).href);
const fixture = new URL("ios/Tests/examples.json", root);
await writeFile(fixture, JSON.stringify(examples.map(({ id, name, spec }) => ({ id, name, spec })), null, 1) + "\n");
console.log(`Wrote ${examples.length} example specs to ${fileURLToPath(fixture)}`);
