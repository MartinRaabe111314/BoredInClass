/* ============================================================
   Bored in Class — five-letter guessing game.
   ============================================================ */

(() => {
  "use strict";

  /* ---------- generic helpers ---------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw == null ? fallback : JSON.parse(raw);
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        /* ignore quota errors */
      }
    },
  };

  /* ============================================================
     THEME
     ============================================================ */
  const THEME_KEY = "bic.theme";
  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    store.set(THEME_KEY, theme);
  }
  applyTheme(store.get(THEME_KEY, "light"));
  $("#themeBtn").addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(next);
  });

  /* ============================================================
     TABS
     ============================================================ */
  const tabs = $$("#tabs .tab");
  const panels = $$(".panel");
  function activateTab(name) {
    tabs.forEach((t) => t.classList.toggle("active", t.dataset.tab === name));
    panels.forEach((p) => p.classList.toggle("active", p.id === `panel-${name}`));
    if (name === "wordle" && window.WordleBot && typeof window.WordleBot.sync === "function") {
      window.WordleBot.sync();
    }
    if (name === "letterboxed" && window.LetterboxBot && typeof window.LetterboxBot.sync === "function") {
      window.LetterboxBot.sync();
    }
    if (name === "nerdle" && window.NerdleBot && typeof window.NerdleBot.sync === "function") {
      window.NerdleBot.sync();
    }
    if (name === "quintessential" && window.QuintessentialBot && typeof window.QuintessentialBot.sync === "function") {
      window.QuintessentialBot.sync();
    }
    if (name === "map-select" && window.__bicMapSelectRefresh) {
      window.__bicMapSelectRefresh();
    }
  }
  tabs.forEach((t) => t.addEventListener("click", () => activateTab(t.dataset.tab)));
  $("#brandHome")?.addEventListener("click", () => activateTab("home"));
  $$("[data-goto-tab]").forEach((b) => {
    b.addEventListener("click", () => {
      const preset = b.dataset.bicMapPreset;
      if (preset) {
        try {
          sessionStorage.setItem("bicMapQuizRegion", preset);
          sessionStorage.setItem("bicMapQuizMode", "countries");
        } catch {
          /* ignore */
        }
      }
      const name = b.dataset.gotoTab;
      activateTab(name);
      if (name === "map" && window.__bicMapQuizEnter) {
        window.__bicMapQuizEnter();
      }
    });
  });

  // Tab key cycles through games (when not focused inside an input).
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Tab" || e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = (document.activeElement?.tagName || "").toLowerCase();
    if (["input", "textarea", "select"].includes(tag)) return;
    e.preventDefault();
    const order = tabs.map((t) => t.dataset.tab);
    const cur = order.indexOf(tabs.find((t) => t.classList.contains("active")).dataset.tab);
    const next = e.shiftKey ? (cur - 1 + order.length) % order.length : (cur + 1) % order.length;
    activateTab(order[next]);
  });

  /* ============================================================
     MODALS + TOAST
     ============================================================ */
  function openModal(id) {
    const m = document.getElementById(id);
    m.setAttribute("aria-hidden", "false");
    m.classList.add("open");
  }
  function closeModal(m) {
    m.setAttribute("aria-hidden", "true");
    m.classList.remove("open");
  }
  $$(".modal").forEach((m) => {
    m.addEventListener("click", (e) => {
      if (e.target === m || e.target.matches("[data-close]")) closeModal(m);
    });
  });
  $("#howToBtn").addEventListener("click", () => openModal("howToModal"));

  const toastEl = $("#toast");
  let toastTimer = 0;
  function toast(msg, ms = 1400) {
    toastEl.textContent = msg;
    toastEl.setAttribute("aria-hidden", "false");
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toastEl.classList.remove("show");
      toastEl.setAttribute("aria-hidden", "true");
    }, ms);
  }

  /* ============================================================
     Five-letter guessing game
     ============================================================ */
  const Wordle = (() => {
    const ROWS = 6;
    const COLS = 5;
    const KEY_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
    const STATE_KEY = "bic.wordle.state";
    const STATS_KEY = "bic.wordle.stats";

    const board = $("#board");
    const keyboard = $("#keyboard");
    const message = $("#message");
    const sub = $("#wordleSub");

    let state;
    let keyEls = {};

    function defaultStats() {
      return {
        played: 0,
        wins: 0,
        streak: 0,
        maxStreak: 0,
        dist: [0, 0, 0, 0, 0, 0],
      };
    }

    function pickAnswer() {
      const list = window.WORDS.ANSWER_WORDS;
      return list[Math.floor(Math.random() * list.length)].toLowerCase();
    }

    function newState() {
      return {
        answer: pickAnswer(),
        guesses: [],
        current: "",
        status: "playing", // playing | won | lost
      };
    }

    /** A "session" counts for stats only after at least one committed (confirmed) guess. */
    function gameStarted() {
      return state.guesses.length > 0;
    }
    function saveState() {
      store.set(STATE_KEY, state);
    }

    function buildBoard() {
      board.innerHTML = "";
      for (let r = 0; r < ROWS; r++) {
        const row = document.createElement("div");
        row.className = "row";
        for (let c = 0; c < COLS; c++) {
          const tile = document.createElement("div");
          tile.className = "tile";
          tile.dataset.row = String(r);
          tile.dataset.col = String(c);
          row.appendChild(tile);
        }
        board.appendChild(row);
      }
    }

    function buildKeyboard() {
      keyboard.innerHTML = "";
      keyEls = {};
      KEY_ROWS.forEach((rowStr, idx) => {
        const row = document.createElement("div");
        row.className = "kb-row";
        if (idx === 2) {
          const enter = makeKey("ENTER", "kb-key wide", () => onEnter());
          row.appendChild(enter);
        }
        for (const ch of rowStr) {
          const k = makeKey(ch.toUpperCase(), "kb-key", () => onLetter(ch));
          keyEls[ch] = k;
          row.appendChild(k);
        }
        if (idx === 2) {
          const back = makeKey("⌫", "kb-key wide", () => onBackspace());
          row.appendChild(back);
        }
        keyboard.appendChild(row);
      });
    }

    function makeKey(label, cls, handler) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = cls;
      b.textContent = label;
      b.addEventListener("click", (e) => {
        e.preventDefault();
        handler();
      });
      return b;
    }

    function evaluate(guess, answer) {
      const result = Array(COLS).fill("absent");
      const ans = answer.split("");
      const used = Array(COLS).fill(false);
      for (let i = 0; i < COLS; i++) {
        if (guess[i] === ans[i]) {
          result[i] = "correct";
          used[i] = true;
        }
      }
      for (let i = 0; i < COLS; i++) {
        if (result[i] === "correct") continue;
        for (let j = 0; j < COLS; j++) {
          if (!used[j] && guess[i] === ans[j]) {
            result[i] = "present";
            used[j] = true;
            break;
          }
        }
      }
      return result;
    }

    function setKeyState(letter, status) {
      const el = keyEls[letter];
      if (!el) return;
      const rank = { absent: 1, present: 2, correct: 3 };
      const cur = el.dataset.state;
      if (!cur || (rank[status] || 0) > (rank[cur] || 0)) {
        el.dataset.state = status;
      }
    }

    function tileAt(r, c) {
      return board.children[r].children[c];
    }

    function paintExisting() {
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const t = tileAt(r, c);
          t.textContent = "";
          t.dataset.state = "";
          t.classList.remove("filled", "flip", "shake", "pop");
        }
      }
      keyEls && Object.values(keyEls).forEach((k) => (k.dataset.state = ""));

      state.guesses.forEach((g, r) => {
        const ev = evaluate(g, state.answer);
        for (let c = 0; c < COLS; c++) {
          const t = tileAt(r, c);
          t.textContent = g[c].toUpperCase();
          t.dataset.state = ev[c];
          t.classList.add("filled", "flip");
          setKeyState(g[c], ev[c]);
        }
      });

      const r = state.guesses.length;
      if (r < ROWS) {
        for (let c = 0; c < state.current.length; c++) {
          const t = tileAt(r, c);
          t.textContent = state.current[c].toUpperCase();
          t.classList.add("filled", "pop");
        }
      }
    }

    function setMessage(text) {
      message.textContent = text || "";
    }

    function shakeRow(r) {
      const row = board.children[r];
      row.classList.remove("shake");
      void row.offsetWidth;
      row.classList.add("shake");
    }

    function onLetter(ch) {
      if (state.status !== "playing") return;
      if (state.current.length >= COLS) return;
      state.current += ch.toLowerCase();
      const r = state.guesses.length;
      const c = state.current.length - 1;
      const t = tileAt(r, c);
      t.textContent = ch.toUpperCase();
      t.classList.add("filled", "pop");
      saveState();
    }

    function onBackspace() {
      if (state.status !== "playing") return;
      if (!state.current) return;
      const r = state.guesses.length;
      const c = state.current.length - 1;
      state.current = state.current.slice(0, -1);
      const t = tileAt(r, c);
      t.textContent = "";
      t.classList.remove("filled", "pop");
      saveState();
    }

    function isValidGuess(word) {
      return window.WORDS.VALID_GUESSES.includes(word);
    }

    function onEnter() {
      if (state.status !== "playing") return;
      const r = state.guesses.length;
      if (state.current.length !== COLS) {
        toast("Not enough letters");
        shakeRow(r);
        return;
      }
      const guess = state.current.toLowerCase();
      if (!isValidGuess(guess)) {
        toast("Not in word list");
        shakeRow(r);
        return;
      }
      const ev = evaluate(guess, state.answer);
      for (let c = 0; c < COLS; c++) {
        const t = tileAt(r, c);
        t.classList.remove("pop");
        t.style.transitionDelay = `${c * 90}ms`;
        t.dataset.state = ev[c];
        t.classList.add("flip");
        setTimeout(() => setKeyState(guess[c], ev[c]), c * 90 + 200);
      }
      state.guesses.push(guess);
      state.current = "";

      if (guess === state.answer) {
        state.status = "won";
        recordResult(true, state.guesses.length);
        setTimeout(() => {
          toast("Nice! 🎉");
          setMessage(`You got it in ${state.guesses.length}.`);
          celebrateRow(r);
        }, COLS * 90 + 350);
      } else if (state.guesses.length >= ROWS) {
        state.status = "lost";
        recordResult(false, 0);
        setTimeout(() => {
          setMessage(`Out of guesses. Word was “${state.answer.toUpperCase()}”.`);
        }, COLS * 90 + 350);
      }
      saveState();
      emitUpdate();
    }

    function celebrateRow(r) {
      const row = board.children[r];
      [...row.children].forEach((t, i) => {
        setTimeout(() => {
          t.classList.add("bounce");
          setTimeout(() => t.classList.remove("bounce"), 700);
        }, i * 80);
      });
    }

    /* ----- stats ----- */
    function getStats() {
      return store.get(STATS_KEY, defaultStats());
    }
    function setStats(s) {
      store.set(STATS_KEY, s);
    }
    function recordResult(won, attempt) {
      if (!won && !gameStarted()) return;
      const s = getStats();
      s.played += 1;
      if (won) {
        s.wins += 1;
        s.streak += 1;
        s.maxStreak = Math.max(s.maxStreak, s.streak);
        if (attempt >= 1 && attempt <= 6) s.dist[attempt - 1] += 1;
      } else {
        s.streak = 0;
      }
      setStats(s);
      refreshStats();
    }
    function refreshStats() {
      const s = getStats();
      $("#statPlayed").textContent = String(s.played);
      $("#statWins").textContent = s.played ? Math.round((s.wins / s.played) * 100) : 0;
      $("#statStreak").textContent = String(s.streak);
      $("#statMax").textContent = String(s.maxStreak);
      const dist = $("#dist");
      dist.innerHTML = "";
      const max = Math.max(1, ...s.dist);
      s.dist.forEach((n, i) => {
        const row = document.createElement("div");
        row.className = "dist-row";
        row.innerHTML = `
          <div class="dist-label">${i + 1}</div>
          <div class="dist-bar"><div class="dist-fill" style="width:${(n / max) * 100}%"></div><span>${n}</span></div>
        `;
        dist.appendChild(row);
      });
    }

    /* ----- physical keyboard ----- */
    function onPhysicalKey(e) {
      if (!$("#panel-wordle").classList.contains("active")) return;
      const tag = (document.activeElement?.tagName || "").toLowerCase();
      if (["input", "textarea", "select"].includes(tag)) return;
      const k = e.key;
      if (k === "Enter") {
        e.preventDefault();
        onEnter();
      } else if (k === "Backspace") {
        e.preventDefault();
        onBackspace();
      } else if (/^[a-zA-Z]$/.test(k)) {
        onLetter(k.toLowerCase());
      }
    }

    function emitUpdate() {
      const detail = {
        guesses: state.guesses.slice(),
        answer: state.answer,
        status: state.status,
      };
      window.__lastWordleState = detail;
      window.dispatchEvent(new CustomEvent("wordle:update", { detail }));
    }

    function newGame() {
      state = newState();
      saveState();
      sub.textContent = "Guess the five-letter word";
      setMessage("");
      paintExisting();
      emitUpdate();
    }

    function giveUp() {
      if (state.status !== "playing") {
        newGame();
        return;
      }
      if (!gameStarted()) {
        newGame();
        return;
      }
      state.status = "lost";
      recordResult(false, 0);
      setMessage(`The word was “${state.answer.toUpperCase()}”.`);
      saveState();
      emitUpdate();
    }

    function init() {
      buildBoard();
      buildKeyboard();
      /* Fresh puzzle each load — stats wait until the first confirmed guess. */
      state = newState();
      saveState();
      paintExisting();
      refreshStats();
      $("#newGameBtn").addEventListener("click", newGame);
      $("#giveUpBtn").addEventListener("click", giveUp);
      document.addEventListener("keydown", onPhysicalKey);
      emitUpdate();
    }

    return { init, refreshStats };
  })();

  /* ============================================================
     REACTION TIME
     ============================================================ */
  const Reaction = (() => {
    const box = $("#reactionBox");
    const text = $("#reactionText");
    const lastEl = $("#reactionLast");
    const bestEl = $("#reactionBest");
    const BEST_KEY = "bic.reaction.best";
    let phase = "idle"; // idle | waiting | go | clicked | early
    let timer = 0;
    let goAt = 0;

    function setPhase(p) {
      phase = p;
      box.dataset.phase = p;
    }
    function reset() {
      setPhase("idle");
      text.textContent = "Click to start. When the box turns green, click as fast as you can.";
    }
    function start() {
      setPhase("waiting");
      text.textContent = "Wait for green…";
      const delay = 800 + Math.random() * 2200;
      timer = window.setTimeout(() => {
        goAt = performance.now();
        setPhase("go");
        text.textContent = "CLICK!";
      }, delay);
    }
    function click() {
      if (phase === "idle" || phase === "clicked" || phase === "early") {
        start();
      } else if (phase === "waiting") {
        clearTimeout(timer);
        setPhase("early");
        text.textContent = "Too early! Click to try again.";
      } else if (phase === "go") {
        const ms = Math.round(performance.now() - goAt);
        setPhase("clicked");
        text.textContent = `${ms} ms — click for another round.`;
        lastEl.textContent = `${ms} ms`;
        const best = store.get(BEST_KEY, null);
        if (best == null || ms < best) {
          store.set(BEST_KEY, ms);
          bestEl.textContent = `${ms} ms`;
        }
      }
    }
    function init() {
      const best = store.get(BEST_KEY, null);
      if (best != null) bestEl.textContent = `${best} ms`;
      box.addEventListener("click", click);
      reset();
    }
    return { init };
  })();

  /* ============================================================
     INIT
     ============================================================ */
  Wordle.init();
  if (window.WordleBot && typeof window.WordleBot.sync === "function") {
    window.WordleBot.sync();
  }
  Reaction.init();
})();
