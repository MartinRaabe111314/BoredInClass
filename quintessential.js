/* ============================================================
   Quintessential — 5×5 letter swap puzzle.
   • Wordle-style row colors (green / yellow / gray).
   • Every puzzle is built by exactly PAR random swaps from the
     solved grid (letters at two positions must differ), so it is
     always solvable in at most PAR moves (reverse the sequence).
   ============================================================ */
(() => {
  "use strict";

  const STORAGE = "bic.quint.v5";
  /** Par: every generated puzzle is solvable in at most this many swaps. */
  const PAR_MOVES = 8;

  const $ = (sel, root = document) => root.querySelector(sel);

  function cloneState(s) {
    try {
      if (typeof structuredClone === "function") return structuredClone(s);
    } catch {
      /* */
    }
    try {
      return JSON.parse(JSON.stringify(s));
    } catch {
      return s;
    }
  }

  const store = {
    get(k, fb) {
      try {
        const r = localStorage.getItem(k);
        return r == null ? fb : JSON.parse(r);
      } catch {
        return fb;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem(k, JSON.stringify(v));
      } catch {
        /* */
      }
    },
  };

  function flattenWords(words) {
    return words
      .slice(0, 5)
      .map((w) => String(w).toLowerCase())
      .join("")
      .slice(0, 25);
  }

  function sortedLetters(s) {
    return s.split("").sort().join("");
  }

  function sameLetterMultiset(grid, targetFlat) {
    return sortedLetters(grid) === sortedLetters(targetFlat);
  }

  /** One row — Wordle multiset. */
  function rowFeedback(answer, guess) {
    const res = /** @type {('correct'|'present'|'absent')[]} */ ([
      "absent",
      "absent",
      "absent",
      "absent",
      "absent",
    ]);
    const pool = answer.split("");
    for (let i = 0; i < 5; i++) {
      if (guess[i] === answer[i]) {
        res[i] = "correct";
        const k = pool.indexOf(guess[i]);
        if (k !== -1) pool.splice(k, 1);
      }
    }
    for (let i = 0; i < 5; i++) {
      if (res[i] === "correct") continue;
      const j = pool.indexOf(guess[i]);
      if (j !== -1) {
        res[i] = "present";
        pool.splice(j, 1);
      }
    }
    return res;
  }

  function tileStates(grid, targets) {
    const out = /** @type {('correct'|'present'|'absent')[]} */ ([]);
    for (let r = 0; r < 5; r++) {
      const rowGuess = grid.slice(r * 5, r * 5 + 5);
      const fb = rowFeedback(targets[r], rowGuess);
      for (let c = 0; c < 5; c++) out.push(fb[c]);
    }
    return out;
  }

  /** @returns {{ themeWord: string, words: string[] }} */
  function pickThemePack() {
    const packs = window.QUINT_THEMES;
    if (Array.isArray(packs) && packs.length) {
      const p = packs[(Math.random() * packs.length) | 0];
      if (p && Array.isArray(p.words) && p.words.length === 5) {
        const words = p.words.map((w) => String(w).toLowerCase());
        if (words.every((x) => x.length === 5) && new Set(words).size === 5)
          return { themeWord: String(p.themeWord || "Theme").trim() || "Theme", words };
      }
    }
    return {
      themeWord: "Classic",
      words: ["apple", "brick", "clove", "dwarf", "elbow"],
    };
  }

  /** Swap two positions with different letters so the string changes. */
  function applyEffectiveSwap(arr) {
    const pairs = [];
    for (let i = 0; i < 25; i++) {
      for (let j = i + 1; j < 25; j++) {
        if (arr[i] !== arr[j]) pairs.push([i, j]);
      }
    }
    if (!pairs.length) return false;
    const [i, j] = pairs[(Math.random() * pairs.length) | 0];
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
    return true;
  }

  /**
   * Start from solved layout; apply exactly PAR_MOVES effective swaps.
   * Reversing those (any optimal path) finishes in at most PAR_MOVES swaps.
   */
  /** @returns {string|null} scrambled grid, or null if generation failed */
  function scrambleWithinPar(targetFlat) {
    for (let attempt = 0; attempt < 400; attempt++) {
      const arr = targetFlat.split("");
      for (let s = 0; s < PAR_MOVES; s++) {
        if (!applyEffectiveSwap(arr)) break;
      }
      const g = arr.join("");
      if (g !== targetFlat && sameLetterMultiset(g, targetFlat)) return g;
    }
    return null;
  }

  /** @typedef {{targets:string[],grid:string,moves:number,status:'playing'|'won',par:number,themeWord:string,lastSwap?:{a:number,b:number}|null}} QState */

  function makeState(targets, grid, themeWord) {
    return {
      targets: targets.map((w) => String(w).toLowerCase()),
      grid,
      moves: 0,
      status: /** @type {'playing'|'won'} */ ("playing"),
      par: PAR_MOVES,
      themeWord: String(themeWord || "Theme").trim() || "Theme",
      lastSwap: null,
    };
  }

  function newPuzzle() {
    for (let t = 0; t < 120; t++) {
      const pack = pickThemePack();
      const words = pack.words;
      const targetFlat = flattenWords(words);
      const grid = scrambleWithinPar(targetFlat);
      if (grid) return makeState(words, grid, pack.themeWord);
    }
    const pack = pickThemePack();
    const targetFlat = flattenWords(pack.words);
    let grid = scrambleWithinPar(targetFlat);
    if (!grid) {
      const arr = targetFlat.split("");
      applyEffectiveSwap(arr);
      grid = arr.join("");
    }
    return makeState(pack.words, grid, pack.themeWord);
  }

  function validPersistedState(s) {
    if (!s || typeof s !== "object") return false;
    if (typeof s.themeWord !== "string" || !s.themeWord.trim()) return false;
    if (typeof s.grid !== "string" || s.grid.length !== 25) return false;
    if (!Array.isArray(s.targets) || s.targets.length !== 5) return false;
    const targets = s.targets.map((w) => String(w).toLowerCase());
    if (!targets.every((w) => w.length === 5)) return false;
    if (typeof s.moves !== "number" || s.moves < 0) return false;
    if (s.status !== "playing" && s.status !== "won") return false;
    if (typeof s.par !== "number" || s.par !== PAR_MOVES) return false;
    const tgt = flattenWords(targets);
    if (!/^[a-z]{25}$/.test(s.grid)) return false;
    if (!sameLetterMultiset(s.grid, tgt)) return false;
    return true;
  }

  function isWinningGrid(grid, targets) {
    return grid === flattenWords(targets);
  }

  const gridEl = $("#qbGrid");
  const movesEl = $("#qbMoves");
  const msgEl = $("#qbMsg");
  const themeEl = $("#qbTheme");
  if (!gridEl || !movesEl) return;

  /** @type {QState} */
  let state = store.get(STORAGE);

  if (!validPersistedState(state)) state = newPuzzle();
  else if (state.status === "playing" && isWinningGrid(state.grid, state.targets)) state.status = "won";

  let selIdx = /** @type {number|null} */ (null);

  function saveState() {
    store.set(STORAGE, state);
    window.dispatchEvent(new CustomEvent("quintessential:update", { detail: cloneState(state) }));
  }

  function movesLine() {
    const par = state.par ?? PAR_MOVES;
    if (state.status === "won") return `${state.moves}/${par} ✓`;
    return `${state.moves}/${par}`;
  }

  function render() {
    gridEl.innerHTML = "";
    gridEl.className = "board qb-board";
    const gridStr = state.grid;
    const targets = state.targets;

    if (gridStr.length !== 25 || targets.length !== 5) {
      movesEl.textContent = "—";
      if (msgEl) msgEl.textContent = "";
      if (themeEl) themeEl.textContent = "—";
      return;
    }

    if (themeEl) {
      const tw = (state.themeWord || "—").toUpperCase();
      themeEl.textContent = tw;
      themeEl.setAttribute(
        "aria-label",
        `Theme ${state.themeWord || "puzzle"} · par ${state.par ?? PAR_MOVES}`,
      );
    }
    if (msgEl) msgEl.textContent = "";

    const states = tileStates(gridStr, targets);

    let i = 0;
    for (let r = 0; r < 5; r++) {
      const rowEl = document.createElement("div");
      rowEl.className = "row";
      for (let c = 0; c < 5; c++) {
        const idx = i++;
        const ch = gridStr[idx];
        const st = states[idx];
        const cel = document.createElement("button");
        cel.type = "button";
        cel.className = "tile filled";
        cel.dataset.idx = String(idx);
        cel.dataset.state = st;
        cel.textContent = ch.toUpperCase();
        cel.disabled = state.status !== "playing";
        cel.setAttribute(
          "aria-label",
          `${ch.toUpperCase()} — row ${r + 1}: ${st === "correct" ? "correct" : st === "present" ? "wrong spot" : "not in row word"}`,
        );
        cel.addEventListener("click", () => onTap(idx));
        if (selIdx === idx) cel.classList.add("qb-picked");
        rowEl.appendChild(cel);
      }
      gridEl.appendChild(rowEl);
    }

    movesEl.textContent = movesLine();
  }

  function onTap(idx) {
    if (state.status !== "playing") return;

    if (selIdx == null) {
      selIdx = idx;
      render();
      return;
    }
    if (selIdx === idx) {
      selIdx = null;
      render();
      return;
    }

    const gArr = [...state.grid];
    const tmp = gArr[selIdx];
    gArr[selIdx] = gArr[idx];
    gArr[idx] = tmp;
    state.grid = gArr.join("");
    state.moves++;
    state.lastSwap = { a: selIdx, b: idx };
    selIdx = null;

    if (isWinningGrid(state.grid, state.targets)) state.status = "won";
    saveState();
    render();
  }

  function newGame() {
    state = newPuzzle();
    selIdx = null;
    saveState();
    render();
  }

  $("#qbNewBtn")?.addEventListener("click", newGame);
  window.__lastQuintState = cloneState(state);
  render();
  saveState();
})();
