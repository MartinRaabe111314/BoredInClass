/* ============================================================
   Letter Boxed (NYT-style) — use letters on four sides of a box;
   two consecutive letters may not be on the same side (including
   the last/first between words). Min word length 3. Each round is
   generated to have at least one two-word solution.
   ============================================================ */
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const BEST2_KEY = "bic.letterboxed.best2";

  let dict = new Set();
  let letterToSide = new Map();
  /** @type {string[][]} top, right, bottom, left — 3 letters each */
  let displaySides = [[], [], [], []];
  let solution = ["", ""];
  let buffer = "";
  let submitted = [];
  let done = false;

  function shuf(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function findPartition(w1, w2) {
    if (w1[w1.length - 1] !== w2[0]) return null;
    if (/(.)\1/.test(w1) || /(.)\1/.test(w2)) return null;
    const letters = [...new Set([...w1, ...w2])];
    if (letters.length !== 12) return null;
    const edges = [];
    for (let i = 0; i < w1.length - 1; i++) edges.push([w1[i], w1[i + 1]]);
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

  function mapToSides4(charSide) {
    const sideChars = [[], [], [], []];
    charSide.forEach((s, ch) => {
      sideChars[s].push(ch);
    });
    if (!sideChars.every((g) => g.length === 3)) return null;
    return sideChars;
  }

  function buildDict() {
    dict = new Set();
    const add = (w) => {
      if (w == null) return;
      const s = String(w).toLowerCase();
      if (/^[a-z]{3,8}$/.test(s)) dict.add(s);
    };
    const addList = (list) => {
      if (Array.isArray(list)) for (const w of list) add(w);
    };
    addList(window.LETTERBOX_WORD_LIST);
    addList(window.LETTERBOX_SUPPLEMENT);
    if (window.WORDS) {
      addList(window.WORDS.VALID_GUESSES);
      addList(window.WORDS.ANSWER_WORDS);
      addList(window.WORDS.EXTRA_GUESSES);
    }
  }

  function poolByLen() {
    const out = { 3: [], 4: [], 5: [], 6: [], 7: [], 8: [] };
    for (const w of dict) {
      if (w.length >= 3 && w.length <= 8 && out[w.length]) {
        if (!/(.)\1/.test(w)) out[w.length].push(w);
      }
    }
    return out;
  }

  function tryOnePair(w1, w2) {
    if (w1 === w2) return null;
    if (new Set([...w1, ...w2]).size !== 12) return null;
    if (w1[w1.length - 1] !== w2[0]) return null;
    if (!dict.has(w1) || !dict.has(w2)) return null;
    const p = findPartition(w1, w2);
    if (!p) return null;
    const s4 = mapToSides4(p);
    if (!s4) return null;
    return { w1, w2, s4 };
  }

  /** w2[0] must equal w1’s last letter (12 unique letters in total). */
  function tryBridgeMix(a, b, n, P) {
    if (!P[a] || !P[b] || !P[a].length || !P[b].length) return null;
    for (let t = 0; t < n; t++) {
      const w1 = P[a][(Math.random() * P[a].length) | 0];
      const c = w1[w1.length - 1];
      const pool = P[b].filter((w) => w[0] === c);
      if (pool.length === 0) continue;
      const w2 = pool[(Math.random() * pool.length) | 0];
      if (w1 === w2) continue;
      if (new Set([...w1, ...w2]).size !== 12) continue;
      const r = tryOnePair(w1, w2);
      if (r) return r;
    }
    return null;
  }

  function generatePuzzle() {
    const P = poolByLen();
    return (
      tryBridgeMix(5, 8, 12000, P) ||
      tryBridgeMix(6, 7, 12000, P) ||
      tryBridgeMix(7, 6, 12000, P) ||
      tryBridgeMix(8, 5, 12000, P) ||
      tryOnePair("benda", "atrophic")
    );
  }

  function permuteVisualSides(four) {
    const order = shuf([0, 1, 2, 3]);
    return order.map((i) => shuf([...four[i]]));
  }

  function newPuzzle() {
    done = false;
    buffer = "";
    submitted = [];
    const g = generatePuzzle();
    solution = [g.w1, g.w2];
    displaySides = permuteVisualSides(g.s4);
    letterToSide = new Map();
    displaySides.forEach((chars, s) => {
      chars.forEach((c) => letterToSide.set(c, s));
    });
    const st = $("lbStatus");
    if (st) {
      st.textContent =
        "Build words (min 3 letters each). The next word reuses the last letter of the previous one (it’s added for you). Par: 2 on every round.";
      st.className = "lb-status";
    }
    render();
  }

  function lastChainChar() {
    if (submitted.length === 0) return null;
    const w = submitted[submitted.length - 1];
    return w[w.length - 1] || null;
  }

  function ensureChainHead() {
    if (done) return;
    if (submitted.length > 0) {
      const br = lastChainChar();
      if (br && buffer.length === 0) buffer = br;
    }
  }

  function canAppend(ch) {
    if (done) return false;
    if (!letterToSide.has(ch)) return false;
    const prev = buffer.length
      ? buffer[buffer.length - 1]
      : lastChainChar();
    if (prev === null) return true;
    return letterToSide.get(prev) !== letterToSide.get(ch);
  }

  function isWordValidOnBoard(word) {
    if (word.length < 3) return false;
    if (!dict.has(word)) return false;
    for (let i = 0; i < word.length; i++) {
      if (!letterToSide.has(word[i])) return false;
    }
    for (let i = 0; i < word.length - 1; i++) {
      if (letterToSide.get(word[i]) === letterToSide.get(word[i + 1])) {
        return false;
      }
    }
    if (submitted.length > 0) {
      const br = lastChainChar();
      if (br !== null && word.length && word[0] !== br) {
        return false;
      }
    }
    return true;
  }

  function isWin() {
    const s = new Set();
    for (const w of submitted) for (const c of w) s.add(c);
    return s.size === 12;
  }

  function trySubmit() {
    if (done) return;
    const w = buffer.toLowerCase();
    if (w.length < 3) {
      flashStatus("Words need at least 3 letters.", "bad");
      return;
    }
    if (!isWordValidOnBoard(w)) {
      if (!dict.has(w)) {
        flashStatus("Not in the word list.", "bad");
      } else {
        flashStatus("Letters must follow the side rules (check your link from the last word).", "bad");
      }
      return;
    }
    submitted.push(w);
    if (isWin()) {
      done = true;
      buffer = "";
      if (submitted.length === 2) {
        let b = 0;
        try {
          b = parseInt(localStorage.getItem(BEST2_KEY) || "0", 10) || 0;
        } catch {
          b = 0;
        }
        b += 1;
        try {
          localStorage.setItem(BEST2_KEY, String(b));
        } catch {
          /* ignore */
        }
      }
      const st = $("lbStatus");
      if (st) {
        if (submitted.length === 2) {
          st.textContent = "Solved in 2! Par hit. New puzzle?";
        } else {
          st.textContent = `Cleared in ${submitted.length} word(s). Par was 2 — try a two-word path next time!`;
        }
        st.className = "lb-status ok";
      }
    } else {
      if ($("lbStatus") && !$("lbStatus").classList.contains("ok")) {
        $("lbStatus").textContent = "Use all 12 different letters. Keep going.";
        $("lbStatus").className = "lb-status";
      }
      {
        const br = lastChainChar();
        buffer = br || "";
      }
    }
    render();
  }

  function flashStatus(msg, cls) {
    const st = $("lbStatus");
    if (!st) return;
    st.textContent = msg;
    st.className = "lb-status " + (cls || "");
  }

  function backspace() {
    if (done) return;
    if (submitted.length > 0 && buffer.length <= 1) return;
    buffer = buffer.slice(0, -1);
    render();
  }

  function onLetterClick(ch) {
    if (done) return;
    ensureChainHead();
    if (buffer.length > 0 && ch === buffer[buffer.length - 1]) {
      if (submitted.length > 0 && buffer.length === 1) {
        return;
      }
      buffer = buffer.slice(0, -1);
      if ($("lbStatus") && !$("lbStatus").classList.contains("ok")) {
        $("lbStatus").textContent = "";
        $("lbStatus").className = "lb-status";
      }
      render();
      return;
    }
    if (!canAppend(ch)) {
      flashStatus("The next letter must be on a different side than the last.", "bad");
      return;
    }
    buffer += ch;
    if ($("lbStatus") && !$("lbStatus").classList.contains("ok")) {
      $("lbStatus").textContent = "";
      $("lbStatus").className = "lb-status";
    }
    render();
  }

  function bindLetterButtons() {
    const root = $("lbSquare");
    if (!root) return;
    root.querySelectorAll(".lb-key").forEach((btn) => {
      const ch = btn.getAttribute("data-ch");
      btn.addEventListener("click", () => onLetterClick(ch));
    });
  }

  function updateLbPath() {
    const root = $("lbSquare");
    const path = $("lbPathLine");
    const svg = $("lbPathSvg");
    if (!root || !path || !svg) return;
    let seq;
    if (submitted.length > 0 && buffer.length > 0) {
      const lastW = submitted[submitted.length - 1];
      const lastC = lastW[lastW.length - 1];
      const b = buffer.split("");
      if (b[0] === lastC) {
        seq = b;
      } else {
        seq = [lastC, ...b];
      }
    } else {
      seq = buffer.split("");
    }
    if (seq.length < 2) {
      path.setAttribute("d", "");
      return;
    }
    const w = root.clientWidth;
    const h = root.clientHeight;
    if (w < 2 || h < 2) return;
    const rr = root.getBoundingClientRect();
    const pts = [];
    for (const ch of seq) {
      const btn = root.querySelector(`.lb-key[data-ch="${ch}"]`);
      if (!btn) continue;
      const b = btn.getBoundingClientRect();
      const x = b.left + b.width / 2 - rr.left;
      const y = b.top + b.height / 2 - rr.top;
      if (
        pts.length &&
        Math.abs(pts[pts.length - 1].x - x) < 0.5 &&
        Math.abs(pts[pts.length - 1].y - y) < 0.5
      ) {
        continue;
      }
      pts.push({ x, y });
    }
    if (pts.length < 2) {
      path.setAttribute("d", "");
      return;
    }
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    const d = "M " + pts.map((p) => p.x + " " + p.y).join(" L ");
    path.setAttribute("d", d);
  }

  function schedulePath() {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        updateLbPath();
      });
    });
  }

  function usedLettersFromWords() {
    const s = new Set();
    for (const w of submitted) {
      for (const c of w) s.add(c);
    }
    return s;
  }

  function emitLetterboxedUpdate() {
    const u = usedLettersFromWords();
    const detail = {
      solution: [solution[0] || "", solution[1] || ""],
      submitted: submitted.slice(),
      buffer: buffer,
      done,
      usedCount: u.size,
      wordCount: submitted.length,
    };
    window.__lastLetterboxedState = detail;
    window.dispatchEvent(new CustomEvent("letterboxed:update", { detail }));
  }

  function keyButton(c, dis, used, isLinkHead) {
    const isUsed = used.has(c);
    const cls =
      "lb-key" +
      (isUsed ? " lb-key-used" : "") +
      (isLinkHead ? " lb-key-bridge" : "");
    const title =
      isUsed && !dis
        ? "Already used in an accepted word — you can use it again in the next word"
        : "";
    return (
      `<button type="button" class="${cls}" data-ch="${c}"${
        dis ? " disabled" : ""
      }${title ? ` title="${title}"` : ""}>${c.toUpperCase()}</button>`
    );
  }

  function render() {
    ensureChainHead();
    const dis = done;
    const used = usedLettersFromWords();
    const link =
      submitted.length > 0 && buffer.length > 0 && lastChainChar() === buffer[0];
    const headForKey = (c) => link && buffer[0] === c;
    if ($("lbTop")) {
      $("lbTop").innerHTML = displaySides[0]
        .map((c) => keyButton(c, dis, used, headForKey(c)))
        .join("");
    }
    if ($("lbRight")) {
      $("lbRight").innerHTML = displaySides[1]
        .map((c) => keyButton(c, dis, used, headForKey(c)))
        .join("");
    }
    if ($("lbBottom")) {
      $("lbBottom").innerHTML = displaySides[2]
        .map((c) => keyButton(c, dis, used, headForKey(c)))
        .join("");
    }
    if ($("lbLeft")) {
      $("lbLeft").innerHTML = displaySides[3]
        .map((c) => keyButton(c, dis, used, headForKey(c)))
        .join("");
    }
    bindLetterButtons();

    if ($("lbBuffer")) {
      const el = $("lbBuffer");
      if (!buffer) {
        el.textContent = "—";
      } else {
        const u = buffer.toUpperCase().split("");
        if (submitted.length > 0) {
          const rest = u
            .slice(1)
            .map((ch) => "·" + ch)
            .join("");
          el.innerHTML = `<span class="lb-buf-link">${u[0]}</span>${rest}`;
        } else {
          el.textContent = u.join("·");
        }
      }
    }
    if ($("lbChain")) {
      $("lbChain").innerHTML = submitted
        .map(
          (w) =>
            `<span class="lb-pill"><span class="lb-pill-w">${w.toUpperCase()}</span></span>`
        )
        .join(" ");
    }
    const b2 = (() => {
      try {
        return parseInt(localStorage.getItem(BEST2_KEY) || "0", 10) || 0;
      } catch {
        return 0;
      }
    })();
    if ($("lbPar2")) $("lbPar2").textContent = String(b2);
    schedulePath();
    emitLetterboxedUpdate();
  }

  function onKey(e) {
    if (!$("panel-letterboxed") || !$("panel-letterboxed").classList.contains("active")) {
      return;
    }
    const t = (e.target && e.target.tagName) || "";
    if (["INPUT", "TEXTAREA"].includes(t)) return;
    if (e.key === "Enter") {
      e.preventDefault();
      if (!done) trySubmit();
      return;
    }
    if (e.key === "Backspace") {
      e.preventDefault();
      if (!done) backspace();
      return;
    }
    if (e.key.length === 1) {
      const k = e.key.toLowerCase();
      if (k >= "a" && k <= "z" && !done) {
        if (canAppend(k)) onLetterClick(k);
        e.preventDefault();
      }
    }
  }

  function showAnswer() {
    if (!solution[0] || !solution[1]) return;
    const st = $("lbStatus");
    if (st) {
      st.textContent = `One 2-word solution: ${solution[0].toUpperCase()} + ${solution[1].toUpperCase()}`;
      st.className = "lb-status";
    }
  }

  function init() {
    if (!$("panel-letterboxed")) return;
    buildDict();
    if (dict.size < 100) {
      if ($("lbStatus")) {
        $("lbStatus").textContent =
          "Word list not loaded. Include letterbox-words.js before this script.";
      }
      return;
    }
    newPuzzle();
    if ($("lbNew")) $("lbNew").addEventListener("click", newPuzzle);
    if ($("lbShow")) $("lbShow").addEventListener("click", showAnswer);
    if ($("lbSubmit")) $("lbSubmit").addEventListener("click", trySubmit);
    if ($("lbClearWord")) {
      $("lbClearWord").addEventListener("click", () => {
        if (done) return;
        buffer = submitted.length && lastChainChar() ? lastChainChar() : "";
        const st = $("lbStatus");
        if (st && !st.classList.contains("ok")) {
          st.textContent = "";
        }
        render();
      });
    }
    if ($("lbClearPuzzle")) {
      $("lbClearPuzzle").addEventListener("click", () => {
        submitted = [];
        buffer = "";
        done = false;
        const st = $("lbStatus");
        if (st) {
          st.textContent = "Puzzle progress cleared — same letters.";
          st.className = "lb-status";
        }
        render();
      });
    }
    document.addEventListener("keydown", onKey);
    const sq = $("lbSquare");
    if (sq && typeof ResizeObserver !== "undefined") {
      new ResizeObserver(() => schedulePath()).observe(sq);
    }
    const panel = $("panel-letterboxed");
    if (panel && typeof IntersectionObserver !== "undefined") {
      new IntersectionObserver(
        (entries) => {
          if (entries[0] && entries[0].isIntersecting) schedulePath();
        },
        { threshold: 0.05 }
      ).observe(panel);
    }
    window.addEventListener("resize", () => {
      if ($("panel-letterboxed") && $("panel-letterboxed").classList.contains("active")) {
        schedulePath();
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
