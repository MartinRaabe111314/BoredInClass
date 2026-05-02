/* ============================================================
   Nerdle-style: 8-slot equation, six guess rows.
   ============================================================ */
(() => {
  "use strict";

  const ROWS = 6;
  const COLS = 8;
  const STORAGE = "bic.nerdle.v1";
  const STATS_KEY = "bic.nerdle.stats.v1";

  const $ = (sel, root = document) => root.querySelector(sel);

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

  function prec(op) {
    return op === "*" || op === "/" ? 2 : op === "+" || op === "-" ? 1 : 0;
  }

  /** @returns {{t:'n',v:number}|{t:'o',v:string}|null}[] */
  function tokenizeExpr(s) {
    const out = [];
    let i = 0;
    while (i < s.length) {
      const ch = s[i];
      if (/\s/.test(ch)) {
        i++;
        continue;
      }
      if (/\d/.test(ch)) {
        let j = i + 1;
        while (j < s.length && /\d/.test(s[j])) j++;
        const raw = s.slice(i, j);
        if (raw.length > 1 && raw[0] === "0") return null;
        const n = parseInt(raw, 10);
        if (Number.isNaN(n)) return null;
        out.push({ t: "n", v: n });
        i = j;
        continue;
      }
      if ("+-*/".includes(ch)) {
        out.push({ t: "o", v: ch });
        i++;
        continue;
      }
      return null;
    }
    return out.length ? out : null;
  }

  function evalRpn(rpn) {
    const st = [];
    for (const t of rpn) {
      if (t.t === "n") {
        st.push(t.v);
        continue;
      }
      if (st.length < 2) return null;
      const b = st.pop();
      const a = st.pop();
      let r;
      if (t.v === "+") r = a + b;
      else if (t.v === "-") r = a - b;
      else if (t.v === "*") r = a * b;
      else if (t.v === "/") {
        if (b === 0 || a % b !== 0) return null;
        r = a / b;
      } else return null;
      if (!Number.isFinite(r) || !Number.isInteger(r)) return null;
      st.push(r);
    }
    if (st.length !== 1) return null;
    return st[0];
  }

  /** @returns {number|null} */
  function evaluateSide(side) {
    const tok = tokenizeExpr(side);
    if (!tok?.length) return null;
    const out = [];
    const ops = [];
    let expectNum = true;
    for (const t of tok) {
      if (t.t === "n") {
        if (!expectNum) return null;
        out.push(t);
        expectNum = false;
      } else {
        if (expectNum) return null;
        const op = t.v;
        while (ops.length && prec(ops[ops.length - 1]) >= prec(op)) {
          const p = ops.pop();
          out.push({ t: "o", v: p });
        }
        ops.push(op);
        expectNum = true;
      }
    }
    if (expectNum) return null;
    while (ops.length) out.push({ t: "o", v: ops.pop() });
    return evalRpn(out);
  }

  function validEquationStr(str) {
    if (typeof str !== "string" || str.length !== COLS || !/^[-+*/=0-9]+$/.test(str)) return false;
    const eqIdx = str.indexOf("=");
    if (eqIdx <= 0 || eqIdx >= str.length - 1 || str.lastIndexOf("=") !== eqIdx) return false;
    const L = str.slice(0, eqIdx);
    const R = str.slice(eqIdx + 1);
    const l = evaluateSide(L);
    const r = evaluateSide(R);
    if (l == null || r == null || l !== r) return false;
    return true;
  }

  function feedback(answer, guess) {
    const res = /** @type {('correct'|'present'|'absent')[]} */ (Array(COLS).fill("absent"));
    const pool = answer.split("");
    for (let i = 0; i < COLS; i++) {
      if (guess[i] === answer[i]) {
        res[i] = "correct";
        pool.splice(pool.indexOf(guess[i]), 1);
      }
    }
    for (let i = 0; i < COLS; i++) {
      if (res[i] !== "correct") {
        const j = pool.indexOf(guess[i]);
        if (j !== -1) {
          res[i] = "present";
          pool.splice(j, 1);
        }
      }
    }
    return res;
  }

  /** Build pool — keep loops small enough for startup */
  function buildPool() {
    const out = new Set();
    const tryAdd = (eq) => {
      if (eq.length === COLS && validEquationStr(eq)) out.add(eq);
    };
    for (let ai = 2; ai < 100; ai++) {
      const as = String(ai);
      if (as.length > 1 && as[0] === "0") continue;
      for (let bi = 2; bi < 100; bi++) {
        const bs = String(bi);
        if (bs.length > 1 && bs[0] === "0") continue;

        /** + */
        {
          const v = ai + bi;
          tryAdd(`${ai}+${bi}=${v}`);
        }
        /** - */
        if (ai > bi) {
          const v = ai - bi;
          tryAdd(`${ai}-${bi}=${v}`);
        }
        /** * (two-digit factors keep length interesting) */
        if (ai >= 10 && bi >= 10) {
          const v = ai * bi;
          if (v <= 999) tryAdd(`${ai}*${bi}=${v}`);
        }
      }
    }
    for (let denom = 2; denom <= 12; denom++) {
      const ds = String(denom);
      if (ds.length > 1 && ds[0] === "0") continue;
      for (let q = 2; q < 999; q++) {
        const num = q * denom;
        if (num < 10 || num > 9999) continue;
        const ns = String(num);
        if (ns.length > 1 && ns[0] === "0") continue;
        const qs = String(q);
        if (qs.length > 1 && qs[0] === "0") continue;
        tryAdd(`${num}/${denom}=${q}`);
      }
    }
    return [...out];
  }

  const POOL_SET = new Set(buildPool());
  const POOL_LIST = [...POOL_SET];
  if (!POOL_LIST.length) POOL_LIST.push("12+34=46");

  function randomEquation() {
    return POOL_LIST[(Math.random() * POOL_LIST.length) | 0] || "12+34=46";
  }

  const boardEl = $("#ndBoard");
  const kbEl = $("#ndKb");
  const msgEl = $("#ndMsg");
  const toastEl = $("#toast");

  /** @type {number|undefined} */
  let toastT;

  if (!boardEl || !kbEl || !msgEl || !toastEl) return;

  function toast(msg, ms = 1400) {
    toastEl.textContent = msg;
    toastEl.setAttribute("aria-hidden", "false");
    toastEl.classList.add("show");
    clearTimeout(toastT);
    toastT = window.setTimeout(() => {
      toastEl.classList.remove("show");
      toastEl.setAttribute("aria-hidden", "true");
    }, ms);
  }

  /** @typedef {{played:number,wins:number,streak:number,maxStreak:number,dist:number[]}} NdStats */
  /** @typedef {{answer:string,guesses:string[],current:string,status:string,counted?:boolean}} NdState */

  function newState() {
    return {
      answer: randomEquation(),
      guesses: [],
      current: "",
      status: "playing",
      counted: false,
    };
  }

  /** @type {NdState} */
  let state = store.get(STORAGE);
  if (!state || typeof state.answer !== "string" || state.answer.length !== COLS || !POOL_SET.has(state.answer))
    state = newState();
  if (typeof state.counted !== "boolean") state.counted = false;

  /** @type {NdStats} */
  let stats = store.get(STATS_KEY, {
    played: 0,
    wins: 0,
    streak: 0,
    maxStreak: 0,
    dist: [0, 0, 0, 0, 0, 0],
  });
  if (
    !stats ||
    typeof stats.played !== "number" ||
    typeof stats.wins !== "number" ||
    typeof stats.streak !== "number" ||
    typeof stats.maxStreak !== "number" ||
    !Array.isArray(stats.dist) ||
    stats.dist.length !== ROWS
  ) {
    stats = {
      played: 0,
      wins: 0,
      streak: 0,
      maxStreak: 0,
      dist: [0, 0, 0, 0, 0, 0],
    };
  }

  function saveState() {
    store.set(STORAGE, state);
    window.__lastNerdleState = structuredClone(state);
    window.dispatchEvent(new CustomEvent("nerdle:update", { detail: structuredClone(state) }));
  }

  function saveStats() {
    store.set(STATS_KEY, stats);
  }

  const ndStatPlayedEl = $("#ndStatPlayed");
  const ndStatWinEl = $("#ndStatWin");
  const ndStatStreakEl = $("#ndStatStreak");
  const ndStatMaxEl = $("#ndStatMax");
  const ndDistEl = $("#ndDist");

  function buildBoardDom() {
    boardEl.innerHTML = "";
    boardEl.className = "nd-board";
    boardEl.style.setProperty("--nd-cols", String(COLS));
    for (let r = 0; r < ROWS; r++) {
      const row = document.createElement("div");
      row.className = "nd-row";
      for (let c = 0; c < COLS; c++) {
        const t = document.createElement("div");
        t.className = "tile";
        row.appendChild(t);
      }
      boardEl.appendChild(row);
    }
  }

  function tileAt(r, c) {
    return boardEl.children[r].children[c];
  }

  function initKb() {
    kbEl.innerHTML = "";
    const rows = [
      ["7", "8", "9", "+"],
      ["4", "5", "6", "-"],
      ["1", "2", "3", "*"],
      ["=", "/", "ENTER", "⌫"],
      ["0"],
    ];
    rows.forEach((labels) => {
      const wrap = document.createElement("div");
      wrap.className = "kb-row nd-kb-row";
      labels.forEach((lbl) => {
        const b = document.createElement("button");
        b.type = "button";
        const wide = lbl.length > 3 || lbl === "ENTER";
        b.className = `kb-key nd-key${wide ? " wide" : ""}`;
        b.textContent = lbl;
        if (!["ENTER", "⌫"].includes(lbl)) b.dataset.key = lbl;
        b.addEventListener("click", () => {
          if (lbl === "ENTER") onEnter();
          else if (lbl === "⌫") onBk();
          else onTap(lbl);
        });
        wrap.appendChild(b);
      });
      kbEl.appendChild(wrap);
    });
    document.addEventListener("keydown", ndPhysical);
  }

  const ndStateRank = { absent: 0, present: 1, correct: 2 };
  function paintKeyboard() {
    kbEl.querySelectorAll(".nd-key").forEach((k) => {
      k.dataset.state = "";
    });
    const best = new Map();
    state.guesses.forEach((g) => {
      const ev = feedback(state.answer, g);
      for (let i = 0; i < g.length; i++) {
        const ch = g[i];
        const next = ev[i];
        const prev = best.get(ch);
        if (!prev || ndStateRank[next] > ndStateRank[prev]) best.set(ch, next);
      }
    });
    best.forEach((st, ch) => {
      const k = kbEl.querySelector(`.nd-key[data-key="${ch}"]`);
      if (k) k.dataset.state = st;
    });
  }

  function paintStats() {
    if (!ndStatPlayedEl || !ndStatWinEl || !ndStatStreakEl || !ndStatMaxEl || !ndDistEl) return;
    ndStatPlayedEl.textContent = String(stats.played);
    ndStatWinEl.textContent = String(stats.played ? Math.round((stats.wins / stats.played) * 100) : 0);
    ndStatStreakEl.textContent = String(stats.streak);
    ndStatMaxEl.textContent = String(stats.maxStreak);
    ndDistEl.innerHTML = "";
    const max = Math.max(1, ...stats.dist);
    stats.dist.forEach((n, i) => {
      const row = document.createElement("div");
      row.className = "dist-row";
      row.innerHTML = `<div class="dist-label">${i + 1}</div><div class="dist-bar"><div class="dist-fill" style="width:${(n / max) * 100}%"></div><span>${n}</span></div>`;
      ndDistEl.appendChild(row);
    });
  }

  function finalizeRoundIfNeeded() {
    if (state.counted || state.status === "playing") return;
    stats.played += 1;
    if (state.status === "won") {
      stats.wins += 1;
      stats.streak += 1;
      stats.maxStreak = Math.max(stats.maxStreak, stats.streak);
      const attempt = state.guesses.length;
      if (attempt >= 1 && attempt <= ROWS) stats.dist[attempt - 1] += 1;
    } else {
      stats.streak = 0;
    }
    state.counted = true;
    saveState();
    saveStats();
  }

  function ndPhysical(e) {
    if (!$("#panel-nerdle")?.classList.contains("active")) return;
    const tag = (document.activeElement?.tagName || "").toLowerCase();
    if (["input", "textarea", "select"].includes(tag)) return;
    if (e.key === "Enter") {
      e.preventDefault();
      onEnter();
    } else if (e.key === "Backspace") {
      e.preventDefault();
      onBk();
    } else if (/^[0-9]$/.test(e.key) || /^[+\-*/=]$/.test(e.key)) {
      e.preventDefault();
      if (state.current.length < COLS) onTap(e.key);
    }
  }

  function paintBoard() {
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        const t = tileAt(r, c);
        t.textContent = "";
        t.dataset.state = "";
        t.classList.remove("filled", "flip", "shake", "pop");
        t.style.transitionDelay = "";
      }

    state.guesses.forEach((g, r) => {
      const ev = feedback(state.answer, g);
      for (let c = 0; c < COLS; c++) {
        const t = tileAt(r, c);
        t.textContent = g[c];
        t.dataset.state = ev[c];
        t.classList.add("filled", "flip");
      }
    });

    const r = state.guesses.length;
    if (state.status === "playing" && r < ROWS) {
      for (let c = 0; c < state.current.length; c++) {
        const t = tileAt(r, c);
        t.textContent = state.current[c];
        t.classList.add("filled", "pop");
      }
    }
    paintKeyboard();
    finalizeRoundIfNeeded();
    paintStats();
    msgEl.textContent =
      state.status === "playing"
        ? ""
        : state.status === "won"
          ? `Solved in ${state.guesses.length}.`
          : state.status === "lost"
            ? `Answer: ${state.answer}`
            : "";
  }

  function shakeRow(rr) {
    const row = boardEl.children[rr];
    row.classList.remove("shake");
    void row.offsetWidth;
    row.classList.add("shake");
  }

  function onTap(ch) {
    if (state.status !== "playing") return;
    if (state.current.length >= COLS) return;
    state.current += ch;
    paintBoard();
    saveState();
  }

  function onBk() {
    if (state.status !== "playing") return;
    state.current = state.current.slice(0, -1);
    paintBoard();
    saveState();
  }

  function onEnter() {
    if (state.status !== "playing") return;
    const r = state.guesses.length;
    if (state.current.length !== COLS) {
      toast("Use all eight slots");
      shakeRow(r);
      return;
    }
    if (!validEquationStr(state.current)) {
      toast("Needs a valid true equation");
      shakeRow(r);
      return;
    }
    const g = state.current;
    const ev = feedback(state.answer, g);
    state.guesses.push(g);

    for (let c = 0; c < COLS; c++) {
      const tile = tileAt(r, c);
      tile.style.transitionDelay = `${c * 70}ms`;
      tile.dataset.state = ev[c];
      tile.textContent = g[c];
      tile.classList.add("filled", "flip");
      tile.classList.remove("pop");
    }
    state.current = "";

    if (g === state.answer) {
      state.status = "won";
      toast("Solved!", 1600);
    } else if (state.guesses.length >= ROWS) state.status = "lost";

    saveState();
    paintBoard();
  }

  function newGame() {
    state = newState();
    saveState();
    paintBoard();
  }

  buildBoardDom();
  initKb();
  $("#ndNewBtn")?.addEventListener("click", newGame);
  paintBoard();
  saveState();
  window.NerdleBotCore = {
    feedback,
    pool: POOL_LIST.slice(),
  };
})();
