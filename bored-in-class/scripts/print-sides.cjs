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
const w1 = "active",
  w2 = "blosmy";
const m = findPartition(w1, w2);
console.log(m);
if (m) {
  for (let s = 0; s < 4; s++) {
    const a = [];
    m.forEach((v, k) => {
      if (v === s) a.push(k);
    });
    console.log("side", s, a.join(""));
  }
}
