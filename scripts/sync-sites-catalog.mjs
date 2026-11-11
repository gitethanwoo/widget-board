import { readFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const destination = new URL("sites/widget-board/lib/catalog/", root);
await mkdir(destination, { recursive: true });
for (const name of ["catalog", "spec"]) {
  const source = await readFile(new URL(`server/src/${name}.ts`, root), "utf8");
  await writeFile(new URL(`${name}.ts`, destination),
    "// Generated from server/src; run node scripts/sync-sites-catalog.mjs from the repository root.\n" +
    source.replace('"./catalog.js"', '"./catalog.ts"'));
}
console.log(`Synced widget catalog to ${fileURLToPath(destination)}`);
