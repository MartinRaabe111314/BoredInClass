/* ============================================================
   Guess-game analysis — entropy-based scoring and skill/luck readout.

   For each guess we compute:
     • Expected information (entropy) of the guess's
       outcome distribution over the current candidate set.
     • The optimal guess (highest expected info) for that turn.
     • Actual information gained = log2(N_before / N_after).
     • Skill  = your_E[I] / optimal_E[I]   (in [0, 1])
     • Luck   = actual_I  − your_E[I]      (positive = lucky)
   ============================================================ */

(() => {
  "use strict";

  /* ---------- core math ---------- */

  // Returns base-3 pattern code for guess vs answer (0=absent, 1=present, 2=correct).
  // 5-letter pattern fits in a single byte (max value 242).
  function patternCode(guess, answer) {
    const used = [false, false, false, false, false];
    let g0, g1, g2, g3, g4;
    let a0 = answer.charCodeAt(0),
      a1 = answer.charCodeAt(1),
      a2 = answer.charCodeAt(2),
      a3 = answer.charCodeAt(3),
      a4 = answer.charCodeAt(4);
    g0 = guess.charCodeAt(0);
    g1 = guess.charCodeAt(1);
    g2 = guess.charCodeAt(2);
    g3 = guess.charCodeAt(3);
    g4 = guess.charCodeAt(4);
    let r0 = 0, r1 = 0, r2 = 0, r3 = 0, r4 = 0;
    if (g0 === a0) { r0 = 2; used[0] = true; }
    if (g1 === a1) { r1 = 2; used[1] = true; }
    if (g2 === a2) { r2 = 2; used[2] = true; }
    if (g3 === a3) { r3 = 2; used[3] = true; }
    if (g4 === a4) { r4 = 2; used[4] = true; }
    const ans = [a0, a1, a2, a3, a4];
    const gs = [g0, g1, g2, g3, g4];
    const rs = [r0, r1, r2, r3, r4];
    for (let i = 0; i < 5; i++) {
      if (rs[i] === 2) continue;
      for (let j = 0; j < 5; j++) {
        if (!used[j] && gs[i] === ans[j]) {
          rs[i] = 1;
          used[j] = true;
          break;
        }
      }
    }
    return rs[0] + 3 * rs[1] + 9 * rs[2] + 27 * rs[3] + 81 * rs[4];
  }

  // Reusable bucket array to avoid GC pressure.
  const BUCKET_LEN = 243; // 3^5
  const buckets = new Int32Array(BUCKET_LEN);

  function entropyOf(guess, candidates) {
    buckets.fill(0);
    const N = candidates.length;
    for (let i = 0; i < N; i++) {
      buckets[patternCode(guess, candidates[i])]++;
    }
    let H = 0;
    const invN = 1 / N;
    for (let i = 0; i < BUCKET_LEN; i++) {
      const n = buckets[i];
      if (n === 0) continue;
      const p = n * invN;
      H -= p * Math.log2(p);
    }
    return H;
  }

  function filterCandidates(candidates, guess, code) {
    const out = [];
    for (let i = 0; i < candidates.length; i++) {
      if (patternCode(guess, candidates[i]) === code) out.push(candidates[i]);
    }
    return out;
  }

  /* ---------- guess ranking ---------- */

  // Score every word in the pool, return sorted [{word, h}, ...] (desc).
  function scoreAll(pool, candidates) {
    const candSet = new Set(candidates);
    const scored = new Array(pool.length);
    for (let i = 0; i < pool.length; i++) {
      const w = pool[i];
      scored[i] = { word: w, h: entropyOf(w, candidates), inCands: candSet.has(w) };
    }
    // Tie-break: prefer words that are themselves possible answers
    // (they have a small chance of being a one-shot win).
    scored.sort((a, b) => {
      if (b.h !== a.h) return b.h - a.h;
      if (a.inCands !== b.inCands) return a.inCands ? -1 : 1;
      return a.word < b.word ? -1 : 1;
    });
    return scored;
  }

  /* ---------- analysis cache ---------- */

  // Cached scoreAll result keyed by candidate-set fingerprint.
  // Same candidate set => same scoring, so we can reuse across guesses.
  const scoreCache = new Map();

  function fingerprint(candidates) {
    if (candidates.length === 0) return "0";
    if (candidates.length > 64) return `${candidates.length}:${candidates[0]}:${candidates[candidates.length - 1]}`;
    return candidates.length + ":" + candidates.join(",");
  }

  function cachedScoreAll(pool, candidates) {
    const key = fingerprint(candidates);
    let cached = scoreCache.get(key);
    if (cached) return cached;
    cached = scoreAll(pool, candidates);
    if (scoreCache.size > 24) scoreCache.clear();
    scoreCache.set(key, cached);
    return cached;
  }

  /* ---------- per-guess analysis ---------- */

  function analyzeGuess(guess, answer, candidatesBefore, pool) {
    const N = candidatesBefore.length;
    if (N === 0) return null;

    const scored = cachedScoreAll(pool, candidatesBefore);
    const best = scored[0];
    const yourEntry = scored.find((s) => s.word === guess) || {
      word: guess,
      h: entropyOf(guess, candidatesBefore),
      inCands: candidatesBefore.includes(guess),
    };
    const yourRank = scored.findIndex((s) => s.word === guess);

    const code = patternCode(guess, answer);
    const after = filterCandidates(candidatesBefore, guess, code);
    const actualInfo = Math.log2(N / Math.max(1, after.length));

    const skill = best.h > 0 ? Math.max(0, Math.min(1, yourEntry.h / best.h)) : 1;
    const luck = actualInfo - yourEntry.h;

    return {
      guess,
      pattern: code,
      candidatesBefore: N,
      candidatesAfter: after.length,
      yourEntropy: yourEntry.h,
      bestEntropy: best.h,
      bestWord: best.word,
      actualInfo,
      skill,
      luck,
      rank: yourRank >= 0 ? yourRank + 1 : null,
      poolSize: scored.length,
      top: scored.slice(0, 5),
      remaining: after.slice(0, 24),
      yourInCandidates: yourEntry.inCands,
    };
  }

  /* ---------- pattern → tile colors helper for rendering ---------- */

  function patternToColors(code) {
    const out = [];
    let c = code;
    for (let i = 0; i < 5; i++) {
      const v = c % 3;
      c = (c - v) / 3;
      out.push(v === 2 ? "correct" : v === 1 ? "present" : "absent");
    }
    return out;
  }

  /* ---------- UI ---------- */

  let panelEl, bodyEl;
  let currentRender = null; // token to ignore stale async results

  function fmtBits(x) {
    if (!isFinite(x)) return "—";
    return `${x.toFixed(2)} bits`;
  }
  function fmtSignedBits(x) {
    if (!isFinite(x)) return "—";
    const sign = x >= 0 ? "+" : "−";
    return `${sign}${Math.abs(x).toFixed(2)} bits`;
  }
  function pct(x) {
    return `${Math.round(x * 100)}%`;
  }
  function escape(s) {
    return s.replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[c]);
  }

  function renderTilesForPattern(guess, code) {
    const cols = patternToColors(code);
    return guess
      .split("")
      .map((ch, i) => `<span class="bot-tile ${cols[i]}">${ch.toUpperCase()}</span>`)
      .join("");
  }

  function renderTopRow(s, isYou, isBest) {
    const tag = isBest
      ? `<span class="bot-tag best">optimal</span>`
      : isYou
      ? `<span class="bot-tag you">your pick</span>`
      : "";
    return `
      <li class="bot-alt ${isYou ? "you" : ""} ${isBest ? "best" : ""}">
        <span class="bot-alt-word">${escape(s.word.toUpperCase())}</span>
        <span class="bot-alt-bits">${s.h.toFixed(2)}</span>
        ${tag}
      </li>`;
  }

  function renderCard(idx, a) {
    const luckClass = a.luck > 0.4 ? "good" : a.luck < -0.4 ? "bad" : "";
    const skillPct = pct(a.skill);
    const skillBar = `<div class="meter"><div class="meter-fill skill" style="width:${
      Math.max(0, Math.min(1, a.skill)) * 100
    }%"></div><span>${skillPct}</span></div>`;

    // Luck visualization: meter centered at 0, range about ±2 bits.
    const luckMid = 0.5;
    const luckOffset = Math.max(-1, Math.min(1, a.luck / 2));
    const left = (luckMid + Math.min(0, luckOffset)) * 100;
    const width = Math.abs(luckOffset) * 100;
    const luckBar = `<div class="meter luck">
      <div class="meter-track"></div>
      <div class="meter-zero"></div>
      <div class="meter-fill luck-${a.luck >= 0 ? "pos" : "neg"}" style="left:${left}%;width:${width}%"></div>
      <span>${fmtSignedBits(a.luck)}</span>
    </div>`;

    const altList = a.top
      .map((s) => renderTopRow(s, s.word === a.guess, s.word === a.bestWord))
      .join("");
    const youInTop = a.top.some((s) => s.word === a.guess);
    const yourLine = !youInTop
      ? `<li class="bot-alt you">
           <span class="bot-alt-word">${escape(a.guess.toUpperCase())}</span>
           <span class="bot-alt-bits">${a.yourEntropy.toFixed(2)}</span>
           <span class="bot-tag you">your pick · #${a.rank ?? "?"}</span>
         </li>`
      : "";

    return `
      <article class="bot-card">
        <header class="bot-card-head">
          <div class="bot-card-title">
            <span class="bot-card-idx">Guess ${idx}</span>
            <span class="bot-card-tiles">${renderTilesForPattern(a.guess, a.pattern)}</span>
          </div>
          <div class="bot-card-meta">
            ${a.candidatesBefore} → ${a.candidatesAfter} ·
            <span title="Information gained">${fmtBits(a.actualInfo)}</span>
          </div>
        </header>

        <div class="bot-meters">
          <div class="bot-meter-row">
            <span class="bot-meter-label">Skill</span>
            ${skillBar}
          </div>
          <div class="bot-meter-row">
            <span class="bot-meter-label">Luck <span class="muted">${luckClass === "good" ? "🍀" : luckClass === "bad" ? "💀" : ""}</span></span>
            ${luckBar}
          </div>
        </div>

        <div class="bot-detail">
          <div>You: <strong>${fmtBits(a.yourEntropy)}</strong> expected · got <strong>${fmtBits(a.actualInfo)}</strong></div>
          <div>Optimal: <strong>${escape(a.bestWord.toUpperCase())}</strong> at ${fmtBits(a.bestEntropy)}</div>
        </div>

        <details class="bot-alts-wrap">
          <summary>Top alternatives ${a.rank ? `· you ranked #${a.rank} of ${a.poolSize}` : ""}</summary>
          <ul class="bot-alts">
            ${altList}
            ${yourLine}
          </ul>
        </details>
      </article>`;
  }

  function renderNextBest(state, candidates, pool) {
    if (candidates.length === 0) {
      return `<article class="bot-card warn">
        <header class="bot-card-head"><div class="bot-card-title"><span class="bot-card-idx">Next</span></div></header>
        <p class="muted">No answers left consistent with the feedback—the puzzle may use a word outside the built-in list, or there's a bug.</p>
      </article>`;
    }

    const scored = cachedScoreAll(pool, candidates);
    const top = scored.slice(0, 5);
    const altList = top
      .map((s, i) => `
        <li class="bot-alt ${i === 0 ? "best" : ""}">
          <span class="bot-alt-word">${escape(s.word.toUpperCase())}</span>
          <span class="bot-alt-bits">${s.h.toFixed(2)}</span>
          ${i === 0 ? `<span class="bot-tag best">recommend</span>` : ""}
        </li>`)
      .join("");

    const remainingPreview = candidates
      .slice(0, 14)
      .map((w) => `<span class="bot-chip">${escape(w.toUpperCase())}</span>`)
      .join("");
    const more = candidates.length > 14 ? `<span class="bot-chip more">+${candidates.length - 14} more</span>` : "";

    return `
      <article class="bot-card next">
        <header class="bot-card-head">
          <div class="bot-card-title">
            <span class="bot-card-idx accent">Suggestions</span>
            <span class="bot-card-meta">${candidates.length} possible answer${candidates.length === 1 ? "" : "s"}</span>
          </div>
        </header>
        <div class="bot-chips">${remainingPreview}${more}</div>
        <details class="bot-alts-wrap" open>
          <summary>Top recommended guesses</summary>
          <ul class="bot-alts">${altList}</ul>
        </details>
      </article>`;
  }

  function renderSummary(analyses, state) {
    if (analyses.length === 0) return "";
    let totalSkill = 0;
    let totalLuck = 0;
    let totalInfo = 0;
    for (const a of analyses) {
      totalSkill += a.skill;
      totalLuck += a.luck;
      totalInfo += a.actualInfo;
    }
    const avgSkill = totalSkill / analyses.length;
    const verdict =
      state.status === "won"
        ? `Solved in ${analyses.length}.`
        : state.status === "lost"
        ? `Out of guesses — answer was ${state.answer.toUpperCase()}.`
        : "Game in progress.";

    return `
      <article class="bot-card summary">
        <header class="bot-card-head">
          <div class="bot-card-title">
            <span class="bot-card-idx accent">Summary</span>
            <span class="bot-card-meta">${verdict}</span>
          </div>
        </header>
        <div class="bot-summary-grid">
          <div><div class="bot-stat-num">${pct(avgSkill)}</div><div class="bot-stat-label">avg skill</div></div>
          <div><div class="bot-stat-num">${fmtSignedBits(totalLuck)}</div><div class="bot-stat-label">total luck</div></div>
          <div><div class="bot-stat-num">${fmtBits(totalInfo)}</div><div class="bot-stat-label">total info</div></div>
        </div>
      </article>`;
  }

  function compute(state) {
    const pool = Array.from(
      new Set(window.WORDS.ANSWER_WORDS.map((w) => w.toLowerCase()))
    );
    let cands = pool.slice();
    const analyses = [];
    for (const g of state.guesses) {
      const a = analyzeGuess(g, state.answer, cands, pool);
      if (!a) break;
      analyses.push(a);
      cands = filterCandidates(cands, g, patternCode(g, state.answer));
    }
    return { analyses, candidates: cands, pool };
  }

  function render(state) {
    if (!panelEl) return;
    panelEl.hidden = !state || state.status === "playing";

    if (!state || !state.answer) {
      bodyEl.innerHTML = `<p class="muted">Make a guess to see analysis.</p>`;
      return;
    }

    if (state.guesses.length === 0) {
      // Pre-game: just show top opening guesses.
      bodyEl.innerHTML = `<p class="muted">Computing best openers…</p>`;
      const token = (currentRender = Symbol("render"));
      setTimeout(() => {
        if (token !== currentRender) return;
        const pool = Array.from(
          new Set(window.WORDS.ANSWER_WORDS.map((w) => w.toLowerCase()))
        );
        const top = cachedScoreAll(pool, pool).slice(0, 5);
        const list = top
          .map((s, i) =>
            `<li class="bot-alt ${i === 0 ? "best" : ""}">
              <span class="bot-alt-word">${escape(s.word.toUpperCase())}</span>
              <span class="bot-alt-bits">${s.h.toFixed(2)}</span>
              ${i === 0 ? `<span class="bot-tag best">best opener</span>` : ""}
             </li>`
          )
          .join("");
        bodyEl.innerHTML = `
          <article class="bot-card next">
            <header class="bot-card-head">
              <div class="bot-card-title">
                <span class="bot-card-idx accent">Openers</span>
                <span class="bot-card-meta">${pool.length} possible answers</span>
              </div>
            </header>
            <details class="bot-alts-wrap" open>
              <summary>Highest expected information</summary>
              <ul class="bot-alts">${list}</ul>
            </details>
          </article>`;
      }, 30);
      return;
    }

    bodyEl.innerHTML = `<p class="muted">Analyzing ${state.guesses.length} guess${
      state.guesses.length === 1 ? "" : "es"
    }…</p>`;
    const token = (currentRender = Symbol("render"));
    setTimeout(() => {
      if (token !== currentRender) return;
      const { analyses, candidates, pool } = compute(state);
      const cards = analyses.map((a, i) => renderCard(i + 1, a));
      if (state.status === "playing") {
        cards.push(renderNextBest(state, candidates, pool));
      }
      cards.push(renderSummary(analyses, state));
      bodyEl.innerHTML = cards.join("");
    }, 30);
  }

  function syncFromState() {
    if (window.__lastWordleState) {
      requestAnimationFrame(() => render(window.__lastWordleState));
    }
  }

  function init() {
    panelEl = document.getElementById("botPanel");
    bodyEl = document.getElementById("botBody");

    window.addEventListener("wordle:update", (e) => {
      window.__lastWordleState = e.detail;
      render(e.detail);
    });
    syncFromState();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Expose a couple of helpers for debugging.
  window.WordleBot = { entropyOf, patternCode, scoreCache, sync: syncFromState };
})();
