const fs = require("fs");
const path = require("path");
const t = fs.readFileSync(path.join(__dirname, "..", "Map SVGs", "world.svg"), "utf8");
const re = /\bid="([A-Z]{2})"/g;
const set = new Set();
let m;
while ((m = re.exec(t))) set.add(m[1]);
console.log([...set].sort().join(","));
