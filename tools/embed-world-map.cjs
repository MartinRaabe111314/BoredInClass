/**
 * Regenerates world-map-data.js from Map SVGs/world.svg (base64 in atob)
 * so the map quiz works when opened as file:// (fetch is blocked for local files).
 *
 * From project root: node tools/embed-world-map.cjs
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const src = path.join(root, "Map SVGs", "world.svg");
const out = path.join(root, "world-map-data.js");

const buf = fs.readFileSync(src);
const b64 = buf.toString("base64");
const banner =
  "/* Auto-generated from Map SVGs/world.svg — run: node tools/embed-world-map.cjs */\n";

const body = `${banner}(() => {\n  "use strict";\n  try {\n    window.__BIC_MAP_SVG = atob(${JSON.stringify(
  b64,
)});\n  } catch (e) {\n    console.error("world-map-data: decode failed", e);\n  }\n})();\n`;

fs.writeFileSync(out, body, "utf8");
process.stdout.write(`Wrote ${out} (${body.length} chars, from ${buf.length} bytes)\n`);
