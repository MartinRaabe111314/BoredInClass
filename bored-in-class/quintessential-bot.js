(() => {
  "use strict";

  const panelEl = document.getElementById("qbBotPanel");
  const bodyEl = document.getElementById("qbBotBody");
  if (!panelEl || !bodyEl) return;

  function rowSolvedCount(grid, target) {
    let n = 0;
    for (let r = 0; r < 5; r++) {
      if (grid.slice(r * 5, r * 5 + 5) === target.slice(r * 5, r * 5 + 5)) n++;
    }
    return n;
  }

  function scoreGrid(grid, target) {
    let score = 0;
    for (let i = 0; i < 25; i++) if (grid[i] === target[i]) score++;
    return score;
  }

  function bestSwaps(state) {
    const target = state.targets.join("").slice(0, 25);
    const src = state.grid;
    const base = scoreGrid(src, target);
    const out = [];
    for (let i = 0; i < 25; i++) {
      for (let j = i + 1; j < 25; j++) {
        if (src[i] === src[j]) continue;
        const arr = src.split("");
        const t = arr[i];
        arr[i] = arr[j];
        arr[j] = t;
        const next = arr.join("");
        const s = scoreGrid(next, target);
        out.push({ i, j, gain: s - base, solvedRows: rowSolvedCount(next, target), score: s });
      }
    }
    out.sort((x, y) => (y.gain - x.gain) || (y.solvedRows - x.solvedRows) || (y.score - x.score));
    return out;
  }

  function posLabel(idx) {
    const r = Math.floor(idx / 5) + 1;
    const c = (idx % 5) + 1;
    return `r${r}c${c}`;
  }

  function render(state) {
    const hide = !state || state.status === "playing";
    panelEl.hidden = hide;
    if (!state || !Array.isArray(state.targets) || typeof state.grid !== "string") {
      if (!hide) bodyEl.innerHTML = `<p class="muted">Start a puzzle to see suggestions.</p>`;
      return;
    }
    const target = state.targets.join("").slice(0, 25);
    const correct = scoreGrid(state.grid, target);
    const solvedRows = rowSolvedCount(state.grid, target);
    const ranked = bestSwaps(state);
    const moves = ranked.slice(0, 5);
    const lastSwap = state.lastSwap;
    const lastKey = lastSwap ? `${Math.min(lastSwap.a, lastSwap.b)}:${Math.max(lastSwap.a, lastSwap.b)}` : "";
    const rankMap = new Map(ranked.map((m, i) => [`${Math.min(m.i, m.j)}:${Math.max(m.i, m.j)}`, i + 1]));
    const lastRank = lastKey ? rankMap.get(lastKey) : null;
    const recs = moves.length
      ? moves.map((m, i) => {
        const key = `${Math.min(m.i, m.j)}:${Math.max(m.i, m.j)}`;
        const isYou = key === lastKey;
        return `
        <li class="bot-alt ${i === 0 ? "best" : ""} ${isYou ? "you" : ""}">
          <span class="bot-alt-word">${posLabel(m.i)} ↔ ${posLabel(m.j)}</span>
          <span class="bot-alt-bits">${m.gain >= 0 ? "+" : ""}${m.gain} match · ${m.solvedRows}/5 rows</span>
          ${i === 0 ? `<span class="bot-tag best">recommend</span>` : ""}
          ${isYou ? `<span class="bot-tag you">your swap</span>` : ""}
        </li>`;
      }).join("")
      : `<li class="bot-alt"><span class="bot-alt-word">No useful swaps found</span></li>`;

    bodyEl.innerHTML = `
      <article class="bot-card summary">
        <header class="bot-card-head">
          <div class="bot-card-title">
            <span class="bot-card-idx accent">State</span>
            <span class="bot-card-meta">${state.themeWord ? `${state.themeWord} · ` : ""}${state.status === "won" ? "Done." : "Playing."}</span>
          </div>
        </header>
        <div class="bot-summary-grid">
          <div><div class="bot-stat-num">${correct}/25</div><div class="bot-stat-label">letters in place</div></div>
          <div><div class="bot-stat-num">${solvedRows}/5</div><div class="bot-stat-label">rows solved</div></div>
          <div><div class="bot-stat-num">${state.moves}</div><div class="bot-stat-label">moves</div></div>
        </div>
        ${lastSwap ? `<p class="bot-detail muted">Last swap <strong>${posLabel(lastSwap.a)} ↔ ${posLabel(lastSwap.b)}</strong> ranked <strong>#${lastRank ?? "?"}</strong> of ${Math.max(ranked.length, 1)} legal swaps.</p>` : ""}
      </article>
      <article class="bot-card next">
        <header class="bot-card-head">
          <div class="bot-card-title"><span class="bot-card-idx accent">Best swaps</span></div>
        </header>
        <details class="bot-alts-wrap" open>
          <summary>Top 5 optimal next swaps</summary>
          <ul class="bot-alts">${recs}</ul>
        </details>
      </article>`;
  }

  function sync() {
    if (window.__lastQuintState) render(window.__lastQuintState);
  }

  window.addEventListener("quintessential:update", (e) => {
    window.__lastQuintState = e.detail;
    render(e.detail);
  });
  sync();
  window.QuintessentialBot = { sync };
})();
