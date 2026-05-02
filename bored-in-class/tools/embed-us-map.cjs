/**
 * Regenerates us-map-data.js from Map SVGs/us.svg (base64 + atob)
 * so the U.S. map quiz works when opened as file://
 *
 * From project root: node tools/embed-us-map.cjs
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const src = path.join(root, "Map SVGs", "us.svg");
const out = path.join(root, "us-map-data.js");

const buf = fs.readFileSync(src);
const b64 = buf.toString("base64");
const banner = "/* Auto-generated from Map SVGs/us.svg — run: node tools/embed-us-map.cjs */\n";

const body = `${banner}(() => {\n  "use strict";\n  try {\n    window.__BIC_US_SVG = atob(${JSON.stringify(
  b64,
)});\n  } catch (e) {\n    console.error("us-map-data: decode failed", e);\n  }\n})();\n`;

fs.writeFileSync(out, body, "utf8");
process.stdout.write(`Wrote ${out} (${(buf.length / 1024).toFixed(1)} KB source)\n`);
