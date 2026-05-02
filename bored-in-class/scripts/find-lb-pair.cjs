const fs = require("fs");
const path = require("path");
const raw = fs.readFileSync(
  path.join(__dirname, "..", "letterbox-words.js"),
  "utf8"
);
const i = raw.indexOf("[");
const j = raw.lastIndexOf("]");
const pool = JSON.parse(raw.slice(i, j + 1));

function findPartition(w1, w2) {
  if (w1[w1.length - 1] === w2[0]) return null;
  if (/(.)\1/.test(w1) || /(.)\1/.test(w2)) return null;
  const letters = [...new Set([...w1, ...w2])];
  if (letters.length !== 12) return null;
  const edges = [];
  for (let i = 0; i < w1.length - 1; i++) edges.push([w1[i], w1[i + 1]]);
  edges.push([w1[w1.length - 1], w2[0]]);
  for (let i = 0; i < w2.length - 1; i++) edges.push([w2[i], w2[i + 1]]);
  for (const [a, b] of edges) {
    if (a === b) return null;
  }
  const order = [...letters].sort(
    (x, y) => degree(y, edges) - degree(x, edges)
  );
  function degree(c, e) {
    let d = 0;
    for (const [a, b] of e) {
      if (a === c || b === c) d++;
    }
    return d;
  }
  const charSide = new Map();
  const sideCount = [0, 0, 0, 0];
  function backtrack(i) {
    if (i === 12) {
      return sideCount.every((c) => c === 3);
    }
    const ch = order[i];
    for (let s = 0; s < 4; s++) {
      if (sideCount[s] >= 3) continue;
      let bad = false;
      for (const [a, b] of edges) {
        if (a === ch && charSide.has(b) && charSide.get(b) === s) {
          bad = true;
          break;
        }
        if (b === ch && charSide.has(a) && charSide.get(a) === s) {
          bad = true;
          break;
        }
      }
      if (bad) continue;
      charSide.set(ch, s);
      sideCount[s]++;
      if (backtrack(i + 1)) return true;
      sideCount[s]--;
      charSide.delete(ch);
    }
    return false;
  }
  if (!backtrack(0)) return null;
  return charSide;
}

const pool3 = pool.filter((w) => w.length === 3);
const pool4 = pool.filter((w) => w.length === 4);
const pool5 = pool.filter((w) => w.length === 5);
const pool6 = pool.filter((w) => w.length === 6);
const pool7 = pool.filter((w) => w.length === 7);
const pool8 = pool.filter((w) => w.length === 8);

const tries = 80000;
let found = 0;
for (let t = 0; t < tries; t++) {
  const w1 = pool6[(Math.random() * pool6.length) | 0];
  const w2 = pool6[(Math.random() * pool6.length) | 0];
  if (w1 === w2) continue;
  if (new Set([...w1, ...w2]).size !== 12) continue;
  if (w1[w1.length - 1] === w2[0]) continue;
  if (findPartition(w1, w2)) {
    console.log("OK6+6", w1, w2);
    found++;
    if (found >= 2) process.exit(0);
  }
}
for (let t = 0; t < tries; t++) {
  const w1 = pool5[(Math.random() * pool5.length) | 0];
  const w2 = pool7[(Math.random() * pool7.length) | 0];
  if (w1 === w2) continue;
  if (new Set([...w1, ...w2]).size !== 12) continue;
  if (w1[w1.length - 1] === w2[0]) continue;
  if (findPartition(w1, w2)) {
    console.log("OK5+7", w1, w2);
    found++;
    if (found >= 2) process.exit(0);
  }
}
for (let t = 0; t < tries; t++) {
  const w1 = pool4[(Math.random() * pool4.length) | 0];
  const w2 = pool8[(Math.random() * pool8.length) | 0];
  if (new Set([...w1, ...w2]).size !== 12) continue;
  if (w1[w1.length - 1] === w2[0]) continue;
  if (findPartition(w1, w2)) {
    console.log("OK4+8", w1, w2);
    found++;
    if (found >= 2) process.exit(0);
  }
}
if (!found) console.log("none");
process.exit(0);
