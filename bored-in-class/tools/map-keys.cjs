const fs = require("fs");
const path = require("path");
const t = fs.readFileSync(path.join(__dirname, "..", "Map SVGs", "world.svg"), "utf8");
const pathRe = /<path\b([^>]*)>/g;
const idAttr = (s) => {
  const m = /\bid="([^"]+)"/.exec(s);
  return m ? m[1].trim() : null;
};
const clsAttr = (s) => {
  const m = /\bclass="([^"]+)"/.exec(s);
  return m ? m[1].trim() : null;
};
function slugClass(cls) {
  return "cls_" + cls.trim().toLowerCase().replace(/\s+/g, "_");
}
const keys = new Set();
let m;
while ((m = pathRe.exec(t))) {
  const tag = m[1];
  const id = idAttr(tag);
  const cls = clsAttr(tag);
  const key = id && id.length ? id : cls ? slugClass(cls) : null;
  if (key) keys.add(key);
}
const arr = [...keys].sort();
const iso = arr.filter((k) => /^[A-Z]{2}$/.test(k));
const slug = arr.filter((k) => k.startsWith("cls_"));
console.log("total", arr.length, "iso", iso.length, "cls", slug.length);
console.log("cls sample", slug.slice(0, 20).join(","));
const fs2 = require("fs");
fs2.writeFileSync(
  path.join(__dirname, "world-map-key-list.txt"),
  arr.join("\n"),
  "utf8",
);
console.log("wrote tools/world-map-key-list.txt");
