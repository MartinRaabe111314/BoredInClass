(() => {
  "use strict";

  const panelEl = document.getElementById("ndBotPanel");
  const bodyEl = document.getElementById("ndBotBody");
  if (!panelEl || !bodyEl) return;

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }

  function patternCode(feedbackArr) {
    let code = 0;
    let mul = 1;
    for (let i = 0; i < feedbackArr.length; i++) {
      const v = feedbackArr[i] === "correct" ? 2 : feedbackArr[i] === "present" ? 1 : 0;
      code += v * mul;
      mul *= 3;
    }
    return code;
  }

  function compatibleCandidates(state, core) {
    let cands = core.pool.slice();
    for (const g of state.guesses) {
      const want = patternCode(core.feedback(state.answer, g));
      cands = cands.filter((cand) => patternCode(core.feedback(cand, g)) === want);
    }
    return cands;
  }

  function entropyForGuess(guess, cands, core) {
    const buckets = new Map();
    const n = cands.length || 1;
    for (const ans of cands) {
      const code = patternCode(core.feedback(ans, guess));
      buckets.set(code, (buckets.get(code) || 0) + 1);
    }
    let h = 0;
    buckets.forEach((count) => {
      const p = count / n;
      h -= p * Math.log2(p);
    });
    return h;
  }

  const scoreCache = new Map();
  function fingerprint(cands) {
    if (!cands.length) return "0";
    if (cands.length <= 40) return `${cands.length}:${cands.join(",")}`;
    return `${cands.length}:${cands[0]}:${cands[cands.length - 1]}`;
  }
  function rankGuesses(cands, core) {
    const key = fingerprint(cands);
    if (scoreCache.has(key)) return scoreCache.get(key);
    const scored = cands.map((g) => ({ guess: g, h: entropyForGuess(g, cands, core) }));
    scored.sort((a, b) => (b.h - a.h) || (a.guess < b.guess ? -1 : 1));
    if (scoreCache.size > 12) scoreCache.clear();
    scoreCache.set(key, scored);
    return scored;
  }

  function rankOfGuess(scored, guess) {
    const idx = scored.findIndex((s) => s.guess === guess);
    return idx >= 0 ? idx + 1 : null;
  }

  function render(state) {
    panelEl.hidden = !state || state.status === "playing";
    const core = window.NerdleBotCore;
    if (!core?.pool?.length || typeof core.feedback !== "function") {
      bodyEl.innerHTML = `<p class="muted">Bot is loading equation data…</p>`;
      return;
    }
    if (!state || !state.answer) {
      bodyEl.innerHTML = `<p class="muted">Start a puzzle to see suggestions.</p>`;
      return;
    }

    const cands = compatibleCandidates(state, core);
    const scored = rankGuesses(cands, core);
    const top = scored.slice(0, 5);
    const lastGuess = state.guesses.length ? state.guesses[state.guesses.length - 1] : null;
    const lastRank = lastGuess ? rankOfGuess(scored, lastGuess) : null;
    const topList = top.length
      ? top
          .map(
            (s, i) =>
              `<li class="bot-alt ${i === 0 ? "best" : ""} ${lastGuess === s.guess ? "you" : ""}"><span class="bot-alt-word">${esc(s.guess)}</span><span class="bot-alt-bits">${s.h.toFixed(2)}</span>${i === 0 ? `<span class="bot-tag best">optimal</span>` : ""}${lastGuess === s.guess ? `<span class="bot-tag you">your guess</span>` : ""}</li>`,
          )
          .join("")
      : `<li class="bot-alt"><span class="bot-alt-word">No candidates</span></li>`;

    const status = state.status === "won"
      ? "Solved."
      : state.status === "lost"
      ? `Out of guesses.`
      : `${6 - state.guesses.length} guesses left.`;

    bodyEl.innerHTML = `
      <article class="bot-card summary">
        <header class="bot-card-head">
          <div class="bot-card-title">
            <span class="bot-card-idx accent">State</span>
            <span class="bot-card-meta">${status}</span>
          </div>
        </header>
        <div class="bot-summary-grid">
          <div><div class="bot-stat-num">${cands.length}</div><div class="bot-stat-label">remaining equations</div></div>
          <div><div class="bot-stat-num">${state.guesses.length}</div><div class="bot-stat-label">guesses used</div></div>
          <div><div class="bot-stat-num">${Math.max(0, 6 - state.guesses.length)}</div><div class="bot-stat-label">guesses left</div></div>
        </div>
        ${lastGuess ? `<p class="bot-detail muted">Last guess <strong>${esc(lastGuess)}</strong> ranked <strong>#${lastRank ?? "?"}</strong> of ${Math.max(scored.length, 1)} by expected information.</p>` : ""}
      </article>
      <article class="bot-card next">
        <header class="bot-card-head">
          <div class="bot-card-title">
            <span class="bot-card-idx accent">Suggestions</span>
          </div>
        </header>
        <details class="bot-alts-wrap" open>
          <summary>Top 5 optimal next equations</summary>
          <ul class="bot-alts">${topList}</ul>
        </details>
      </article>`;
  }

  function sync() {
    if (window.__lastNerdleState) render(window.__lastNerdleState);
  }

  window.addEventListener("nerdle:update", (e) => {
    window.__lastNerdleState = e.detail;
    render(e.detail);
  });
  sync();
  window.NerdleBot = { sync };
})();
