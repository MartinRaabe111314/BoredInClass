/* ============================================================
   Bored in Class — extra games:
     • Typing speed test
     • Chess puzzles (mate in 1 / mate in 2)
     • Checkers
     • Tic tac toe vs computer
     • Cracker Barrel peg solitaire
     • Curveball (pseudo-3D pong)
     • Klondike + Spider solitaire
   ============================================================ */

(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const store = {
    get(k, d) {
      try {
        const r = localStorage.getItem(k);
        return r == null ? d : JSON.parse(r);
      } catch { return d; }
    },
    set(k, v) {
      try { localStorage.setItem(k, JSON.stringify(v)); } catch {}
    },
  };

  /* ============================================================
     TYPING TEST
     ============================================================ */
  const Typing = (() => {
    // ~150 common, easy-to-type English words.
    const COMMON = (
      "the be of and a to in he have it that for they with as not on she at " +
      "by this we you do but from or which one would all will there say who " +
      "make when can more if no out so what time up go about than into could " +
      "state only new year some take come these know see use get like then " +
      "first any work now may such give over think most even find day also " +
      "after way many must look before great back through long where much " +
      "should well people down own just because good each those feel seem " +
      "how high too place little world very still hand old life tell write " +
      "become here show house both between need mean call under last right " +
      "move thing school never same another begin while number part turn " +
      "real leave might want point form off child few small since against " +
      "ask late home large person end open public follow during without " +
      "again hold around possible head word problem however lead system " +
      "order learn music family friend water today house light build run"
    ).split(/\s+/).filter(Boolean);

    let words = [];
    let typed = "";
    let correctChars = 0;
    let totalChars = 0;
    let startTime = 0;
    let duration = 30;
    let timer = 0;
    let active = false;
    let finished = false;

    const textEl = () => $("#typingText");
    const innerEl = () => $("#typingTextInner");
    const wpmEl = () => $("#typingWPM");
    const accEl = () => $("#typingAcc");
    const timeEl = () => $("#typingTime");
    const bestEl = () => $("#typingBest");
    const durationEl = () => $("#typingDuration");

    function genWords(n) {
      const arr = new Array(n);
      for (let i = 0; i < n; i++) arr[i] = COMMON[Math.floor(Math.random() * COMMON.length)];
      return arr;
    }

    function fullText() {
      return words.join(" ");
    }

    function render() {
      const t = textEl();
      const inner = innerEl();
      const text = fullText();
      const tlen = typed.length;
      // Wrap each word so we can measure line position by *word*, which is
      // way more reliable than asking an inline character for its offsetTop.
      const out = [];
      const tokens = text.split(/(\s+)/); // keep separators
      let charIdx = 0;
      let wordIdx = 0;
      for (const tok of tokens) {
        if (tok === "") continue;
        const isSpace = /^\s+$/.test(tok);
        if (isSpace) {
          for (const ch of tok) {
            let cls = "";
            if (charIdx < tlen) cls = typed[charIdx] === ch ? "ok" : "bad";
            else if (charIdx === tlen) cls = "cursor";
            out.push(`<span class="tt-ch ${cls}">&nbsp;</span>`);
            charIdx++;
          }
        } else {
          const wordStart = charIdx;
          let wordHTML = "";
          for (const ch of tok) {
            let cls = "";
            if (charIdx < tlen) cls = typed[charIdx] === ch ? "ok" : "bad";
            else if (charIdx === tlen) cls = "cursor";
            wordHTML += `<span class="tt-ch ${cls}">${ch}</span>`;
            charIdx++;
          }
          const containsCursor = tlen >= wordStart && tlen <= charIdx;
          out.push(
            `<span class="tt-word${containsCursor ? " active" : ""}" data-w="${wordIdx}">${wordHTML}</span>`
          );
          wordIdx++;
        }
      }
      inner.innerHTML = out.join("");

      // Horizontal scroll: keep the cursor anchored at ~30% of the visible
      // width, so already-typed text slides off to the left while upcoming
      // words flow in from the right.
      const cursor = inner.querySelector(".tt-ch.cursor");
      if (cursor) {
        const anchor = t.clientWidth * 0.30;
        const x = cursor.offsetLeft - anchor;
        const target = Math.max(0, x);
        inner.style.transform = `translateX(${-target}px)`;
      } else {
        inner.style.transform = "translateX(0)";
      }
    }

    function reset() {
      words = genWords(120);
      typed = "";
      correctChars = 0;
      totalChars = 0;
      duration = parseInt(durationEl().value, 10) || 30;
      active = false;
      finished = false;
      startTime = 0;
      clearInterval(timer);
      timeEl().textContent = duration;
      wpmEl().textContent = "0";
      accEl().textContent = "100";
      loadBest();
      render();
    }

    function loadBest() {
      const dur = parseInt(durationEl().value, 10) || 30;
      const best = store.get(`bic.typing.best.${dur}`, 0);
      bestEl().textContent = best > 0 ? `${best}` : "—";
    }

    function tick() {
      if (!active) return;
      const elapsed = (Date.now() - startTime) / 1000;
      const remaining = Math.max(0, duration - elapsed);
      timeEl().textContent = Math.ceil(remaining);
      updateLiveStats(elapsed);
      if (remaining <= 0) finish();
    }

    function updateLiveStats(elapsed) {
      const minutes = Math.max(elapsed, 0.001) / 60;
      const wpm = correctChars / 5 / minutes;
      wpmEl().textContent = String(Math.max(0, Math.round(wpm)));
      const acc = totalChars > 0 ? (correctChars / totalChars) * 100 : 100;
      accEl().textContent = String(Math.round(acc));
    }

    function finish() {
      active = false;
      finished = true;
      clearInterval(timer);
      updateLiveStats(duration);
      const wpm = parseInt(wpmEl().textContent, 10) || 0;
      const dur = duration;
      const key = `bic.typing.best.${dur}`;
      const best = store.get(key, 0);
      if (wpm > best) {
        store.set(key, wpm);
        bestEl().textContent = String(wpm);
      }
      timeEl().textContent = "0";
    }

    function panelActive() {
      return $("#panel-typing")?.classList.contains("active");
    }

    function onKeydown(e) {
      if (!panelActive()) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "Tab") return; // let the tab cycler handle this

      if (finished) {
        // Any key restarts after finish.
        if (e.key === "Escape" || e.key.length === 1 || e.key === "Backspace" || e.key === "Enter") {
          reset();
          e.preventDefault();
        }
        return;
      }

      if (e.key === "Backspace") {
        e.preventDefault();
        if (typed.length === 0) return;
        const last = typed[typed.length - 1];
        const target = fullText()[typed.length - 1];
        if (last === target) correctChars = Math.max(0, correctChars - 1);
        totalChars = Math.max(0, totalChars - 1);
        typed = typed.slice(0, -1);
        render();
        return;
      }

      if (e.key.length !== 1) return;
      e.preventDefault();

      if (!active) {
        active = true;
        startTime = Date.now();
        clearInterval(timer);
        timer = window.setInterval(tick, 100);
      }

      const target = fullText()[typed.length];
      typed += e.key;
      totalChars++;
      if (e.key === target) correctChars++;
      // Append more words if running low.
      if (typed.length > fullText().length - 80) words = words.concat(genWords(80));
      render();
    }

    function init() {
      durationEl().addEventListener("change", reset);
      $("#typingRestart").addEventListener("click", reset);
      document.addEventListener("keydown", onKeydown);
      reset();
    }

    return { init };
  })();

  /* ============================================================
     CHESS PUZZLES
     Hand-verified mate-in-1 / mate-in-2 positions.
     Solutions are pre-computed move sequences; user moves alternate
     with forced opponent moves.
     ============================================================ */
  const Chess = (() => {
    const PUZZLES = [
      // ----- Mate in 1 -----
      {
        title: "Mate in 1 — White to move",
        hint: "Use the open file against a sleepy back rank.",
        fen: "6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1",
        solution: [{ from: "a1", to: "a8" }], // Ra8#
      },
      {
        title: "Mate in 1 — White to move",
        hint: "The knight on e7 already controls g6 and g8.",
        fen: "8/4N1pk/8/8/8/8/6K1/R7 w - - 0 1",
        solution: [{ from: "a1", to: "h1" }], // Rh1# (Anastasia's-style)
      },
      {
        title: "Mate in 1 — White to move",
        hint: "His own pieces are doing your work — find the smother.",
        fen: "6rk/6pp/3N4/8/8/8/8/6K1 w - - 0 1",
        solution: [{ from: "d6", to: "f7" }], // Nf7#
      },
      {
        title: "Mate in 1 — White to move",
        hint: "Get the queen one step closer, with the king as defender.",
        fen: "7k/5Q2/5K2/8/8/8/8/8 w - - 0 1",
        solution: [{ from: "f7", to: "g7" }], // Qg7#
      },
      {
        title: "Mate in 1 — White to move",
        hint: "The white king defends the queen on its mating square.",
        fen: "k7/8/2K5/8/8/8/8/1Q6 w - - 0 1",
        solution: [{ from: "b1", to: "b7" }], // Qb7#
      },
      {
        title: "Mate in 1 — White to move",
        hint: "Two rooks: one cuts off the 7th rank, the other delivers.",
        fen: "6k1/R7/8/8/8/8/8/1R5K w - - 0 1",
        solution: [{ from: "b1", to: "b8" }], // Rb8#
      },
      {
        title: "Mate in 1 — White to move",
        hint: "His own pawn keeps him in the corner — exploit the open file.",
        fen: "7k/7p/5K2/8/8/Q7/8/8 w - - 0 1",
        solution: [{ from: "a3", to: "a8" }], // Qa8#
      },
      {
        title: "Mate in 1 — White to move",
        hint: "His rook smothers the back, his pawn smothers the side. Knight delivers.",
        fen: "8/8/8/8/8/5K2/4N2p/6rk w - - 0 1",
        solution: [{ from: "e2", to: "g3" }], // Ng3#
      },
      {
        title: "Mate in 1 — White to move",
        hint: "Down the h-file with the king covering b2.",
        fen: "8/8/8/8/7Q/1K6/p7/k7 w - - 0 1",
        solution: [{ from: "h4", to: "h1" }], // Qh1#
      },
      {
        title: "Mate in 1 — Black to move",
        hint: "Classic back rank — find the mating file.",
        fen: "4r1k1/8/8/8/8/8/6PP/7K b - - 0 1",
        solution: [{ from: "e8", to: "e1" }], // Re1#
      },
      {
        title: "Mate in 1 — White to move",
        hint: "Queen lands next to the king, defended by your own.",
        fen: "7k/8/6K1/8/8/8/8/7Q w - - 0 1",
        solution: [{ from: "h1", to: "h7" }], // Qh7#
      },
      {
        title: "Mate in 1 — White to move",
        hint: "All escape squares are already covered by the king on g6.",
        fen: "6k1/8/6K1/8/8/8/8/Q7 w - - 0 1",
        solution: [{ from: "a1", to: "a8" }], // Qa8#
      },
      {
        title: "Mate in 1 — White to move",
        hint: "Lawnmower the rook up the open file.",
        fen: "7k/5K2/8/8/8/8/8/6R1 w - - 0 1",
        solution: [{ from: "g1", to: "g8" }], // Rg8#
      },
      {
        title: "Mate in 1 — White to move",
        hint: "Up the e-file, while the king covers g7.",
        fen: "7k/7p/4Q1K1/8/8/8/8/8 w - - 0 1",
        solution: [{ from: "e6", to: "e8" }], // Qe8#
      },
      {
        title: "Mate in 1 — White to move",
        hint: "Slide along the seventh, defended from g6.",
        fen: "7k/Q7/6K1/8/8/8/8/8 w - - 0 1",
        solution: [{ from: "a7", to: "h7" }], // Qh7#
      },
      {
        title: "Mate in 1 — Black to move",
        hint: "His own pawns block g2 and h2 — find the mating square.",
        fen: "k7/8/8/8/q7/8/6PP/7K b - - 0 1",
        solution: [{ from: "a4", to: "d1" }], // Qd1#
      },
      {
        title: "Mate in 1 — White to move",
        hint: "His own pawn traps him in the corner; bishop delivers, king defends.",
        fen: "k7/p1K5/8/8/8/8/6B1/8 w - - 0 1",
        solution: [{ from: "g2", to: "b7" }], // Bb7#
      },
      {
        title: "Mate in 1 — White to move",
        hint: "Long diagonal sweep, the king's pawn boxes him in.",
        fen: "7k/6p1/6K1/3Q4/8/8/8/8 w - - 0 1",
        solution: [{ from: "d5", to: "a8" }], // Qa8#
      },
      {
        title: "Mate in 1 — White to move",
        hint: "Drop the queen onto the 7th, defended by the king.",
        fen: "4k3/8/5K2/8/8/8/8/4Q3 w - - 0 1",
        solution: [{ from: "e1", to: "e7" }], // Qe7#
      },
      // ----- Mate in 2 -----
      {
        title: "Mate in 2 — White to move",
        hint: "Sacrifice the queen so the bishop's diagonal locks the king in.",
        fen: "5r1k/6pp/8/3QN3/8/1B6/8/6K1 w - - 0 1",
        solution: [
          { from: "d5", to: "g8" }, // 1. Qg8+
          { from: "f8", to: "g8" }, // 1...Rxg8 (forced — bishop on b3 covers g8)
          { from: "e5", to: "f7" }, // 2. Nf7#
        ],
      },
    ];

    const PIECE_GLYPHS = {
      K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘", P: "♙",
      k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟",
    };

    let board = []; // board[0] = rank 8, board[7] = rank 1
    let toMove = "w";
    let puzzleIdx = 0;
    let stepIdx = 0;
    let selected = null;
    let lastMove = null; // {from, to} for highlighting
    let solved = store.get("bic.chess.solved", 0);
    let streak = store.get("bic.chess.streak", 0);
    let solvedThis = false;
    let locked = false;
    // Randomized order through PUZZLES — each puzzle appears once before any
    // repeats; we reshuffle once we've cycled through.
    let order = [];
    let orderPos = 0;

    function shuffle(arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    }
    function reshuffle(skipFirst) {
      const idxs = PUZZLES.map((_, i) => i);
      order = shuffle(idxs);
      // Make sure the new first puzzle differs from the one we just finished.
      if (skipFirst != null && order.length > 1 && order[0] === skipFirst) {
        [order[0], order[1]] = [order[1], order[0]];
      }
      orderPos = 0;
    }

    function parseFEN(fen) {
      const ranks = fen.split(" ")[0].split("/");
      const tm = fen.split(" ")[1] || "w";
      const b = [];
      for (let r = 0; r < 8; r++) {
        const row = [];
        for (const ch of ranks[r]) {
          if (/\d/.test(ch)) {
            const n = parseInt(ch, 10);
            for (let i = 0; i < n; i++) row.push(null);
          } else {
            row.push(ch);
          }
        }
        b.push(row);
      }
      return { board: b, toMove: tm };
    }

    function sqToRC(sq) {
      const file = sq.charCodeAt(0) - 97;
      const rank = parseInt(sq[1], 10);
      return { row: 8 - rank, col: file };
    }
    function rcToSq(row, col) {
      return String.fromCharCode(97 + col) + (8 - row);
    }

    function curPuzzle() { return PUZZLES[puzzleIdx]; }
    function curSolution() { return curPuzzle().solution; }

    function isUserStep() {
      // Step 0 is user, alternating. (We assume puzzles always start with user-to-move.)
      return stepIdx % 2 === 0;
    }

    function isPlayerPiece(piece) {
      const isWhite = piece === piece.toUpperCase();
      const userIsWhite = toMove === "w" ? isUserStep() : !isUserStep();
      return isWhite === userIsWhite;
    }

    function makeMove(from, to) {
      const f = sqToRC(from);
      const t = sqToRC(to);
      const piece = board[f.row][f.col];
      board[f.row][f.col] = null;
      board[t.row][t.col] = piece;
      lastMove = { from, to };
    }

    function renderBoard() {
      const el = $("#chessBoard");
      el.innerHTML = "";
      // Rank labels on left, file labels on bottom.
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const sq = document.createElement("div");
          const isLight = (r + c) % 2 === 0;
          sq.className = `chess-sq ${isLight ? "light" : "dark"}`;
          sq.dataset.square = rcToSq(r, c);

          // Square coordinates labels.
          if (c === 0) {
            const rl = document.createElement("span");
            rl.className = "chess-rank-label";
            rl.textContent = String(8 - r);
            sq.appendChild(rl);
          }
          if (r === 7) {
            const fl = document.createElement("span");
            fl.className = "chess-file-label";
            fl.textContent = String.fromCharCode(97 + c);
            sq.appendChild(fl);
          }

          const piece = board[r][c];
          if (piece) {
            const p = document.createElement("span");
            const isWhite = piece === piece.toUpperCase();
            p.className = `chess-piece ${isWhite ? "white" : "black"}`;
            p.textContent = PIECE_GLYPHS[piece];
            sq.appendChild(p);
          }

          if (selected === sq.dataset.square) sq.classList.add("selected");
          if (lastMove && (sq.dataset.square === lastMove.from || sq.dataset.square === lastMove.to)) {
            sq.classList.add("last-move");
          }
          sq.addEventListener("click", () => onSquareClick(sq.dataset.square));
          el.appendChild(sq);
        }
      }
    }

    function setStatus(text, kind = "") {
      const s = $("#chessStatus");
      s.textContent = text;
      s.className = "chess-status" + (kind ? " " + kind : "");
    }

    function onSquareClick(sq) {
      if (locked) return;
      if (stepIdx >= curSolution().length) return;

      const { row, col } = sqToRC(sq);
      const piece = board[row][col];

      if (selected == null) {
        if (piece && isPlayerPiece(piece)) {
          selected = sq;
          renderBoard();
        }
        return;
      }

      if (sq === selected) {
        selected = null;
        renderBoard();
        return;
      }

      // If clicking another own piece, switch selection.
      if (piece && isPlayerPiece(piece)) {
        selected = sq;
        renderBoard();
        return;
      }

      attempt(selected, sq);
    }

    function attempt(from, to) {
      const expected = curSolution()[stepIdx];
      if (from === expected.from && to === expected.to) {
        makeMove(from, to);
        selected = null;
        stepIdx++;
        renderBoard();

        if (stepIdx >= curSolution().length) {
          finishPuzzle(true);
        } else {
          // Play opponent's forced response after a brief pause.
          locked = true;
          setStatus("Good move. Opponent responds…");
          setTimeout(() => {
            const m = curSolution()[stepIdx];
            makeMove(m.from, m.to);
            stepIdx++;
            locked = false;
            renderBoard();
            if (stepIdx >= curSolution().length) {
              finishPuzzle(true);
            } else {
              setStatus("Now find the mate.");
            }
          }, 700);
        }
      } else {
        selected = null;
        if (!solvedThis) {
          // Wrong move — keep position, just say try again.
          setStatus("That's not the right move. Try again.", "error");
        }
        renderBoard();
      }
    }

    function finishPuzzle(byUser) {
      if (solvedThis) return;
      solvedThis = true;
      if (byUser) {
        solved++;
        streak++;
        store.set("bic.chess.solved", solved);
        store.set("bic.chess.streak", streak);
        $("#chessSolved").textContent = String(solved);
        $("#chessStreak").textContent = String(streak);
        setStatus("Checkmate! Nicely done. Hit Next puzzle for another.", "success");
      } else {
        streak = 0;
        store.set("bic.chess.streak", 0);
        $("#chessStreak").textContent = "0";
        setStatus("Solution shown.", "muted");
      }
    }

    function loadPuzzle(idx) {
      puzzleIdx = ((idx % PUZZLES.length) + PUZZLES.length) % PUZZLES.length;
      const p = curPuzzle();
      const parsed = parseFEN(p.fen);
      board = parsed.board;
      toMove = parsed.toMove;
      stepIdx = 0;
      selected = null;
      lastMove = null;
      solvedThis = false;
      locked = false;
      $("#chessPrompt").textContent = p.title;
      $("#chessIndex").textContent = `Puzzle ${orderPos + 1} of ${PUZZLES.length}`;
      setStatus("Click a piece, then click its target square.");
      renderBoard();
    }

    function nextPuzzle() {
      orderPos++;
      if (orderPos >= order.length) reshuffle(puzzleIdx);
      loadPuzzle(order[orderPos]);
    }

    function showHint() {
      if (stepIdx >= curSolution().length) return;
      const expected = curSolution()[stepIdx];
      selected = expected.from;
      setStatus(`Hint: try the piece on ${expected.from}. (${curPuzzle().hint})`, "hint");
      renderBoard();
    }

    function showSolution() {
      if (stepIdx >= curSolution().length) return;
      // Streak resets when you ask for the solution.
      streak = 0;
      store.set("bic.chess.streak", 0);
      $("#chessStreak").textContent = "0";

      locked = true;
      const playNext = () => {
        if (stepIdx >= curSolution().length) {
          locked = false;
          finishPuzzle(false);
          return;
        }
        const m = curSolution()[stepIdx];
        makeMove(m.from, m.to);
        stepIdx++;
        renderBoard();
        setTimeout(playNext, 600);
      };
      playNext();
    }

    function init() {
      $("#chessHintBtn").addEventListener("click", showHint);
      $("#chessSolveBtn").addEventListener("click", showSolution);
      $("#chessNextBtn").addEventListener("click", nextPuzzle);
      $("#chessSolved").textContent = String(solved);
      $("#chessStreak").textContent = String(streak);
      reshuffle(null);
      loadPuzzle(order[0]);
    }

    return { init };
  })();

  /* ============================================================
     CURVEBALL — pseudo-3D pong (Flash-style):
     z ∈ [0,1]: you at z=0, opponent at z=1. The ball only crosses each
     plane while moving the correct way (no double hits / ghost misses).
     Spin comes from (1) where you hit the paddle, and (2) paddle
     movement at impact — like the original “move while striking” rule.
     In-flight, spin bends the path (Magnus-style cross terms + decay).
     ============================================================ */
  const Curveball = (() => {
    const canvas = () => $("#curveballCanvas");
    const overlay = () => $("#curveballOverlay");
    const titleEl = () => $("#curveTitle");
    const subEl = () => $("#curveSub");

    const W = 1.0;
    const H = 0.7;
    const PADDLE_W = 0.34;
    const PADDLE_H = 0.26;
    const BALL_R = 0.05;
    const WIN_SCORE = 5;
    const CB_DIFF_KEY = "bic.curveball.diff";
    /** Base |vz| in court units / ms (Flash-like rally speed). */
    const BASE_VZ = 0.00095;
    const MAX_V = 0.0032;

    function curveDiff() {
      let d = store.get(CB_DIFF_KEY, 3);
      if (typeof d !== "number" || d < 1 || d > 5) d = 3;
      return d;
    }
    /** 1 = slow ball, sluggish AI · 5 = fast, sharp AI */
    function effBaseVz() {
      return BASE_VZ * (0.78 + 0.085 * (curveDiff() - 1));
    }
    function effAiSp() {
      return 0.5 + 0.125 * (curveDiff() - 1);
    }
    function effMaxV() {
      return MAX_V * (0.9 + 0.025 * (curveDiff() - 1));
    }
    /** Off-center / movement → spin, applied each ms in update (Flash-like bend). */
    const CURVE_ACCEL = 0.000022;
    const MAGNUS = 0.00055;
    const SPIN_DECAY = 0.9993;
    const ball = { x: 0, y: 0, z: 0.5, vx: 0, vy: 0, vz: 0, sx: 0, sy: 0 };
    const paddle = { x: 0, y: 0, vxp: 0, vyp: 0 };
    const ai = { x: 0, y: 0, vxp: 0, vyp: 0 };
    let lastPaddle = { x: 0, y: 0, t: 0 };
    let scores = { you: 0, opp: 0 };
    let phase = "idle"; // idle | serving | playing | over
    let lastFrame = 0;
    let serveAt = 0;
    let serveDir = 1; // +1 = ball heading away (you serve), -1 = ball heading toward you
    let mouseAttached = false;

    function panelActive() {
      return $("#panel-curveball")?.classList.contains("active");
    }

    function setOverlay(title, sub, show) {
      titleEl().textContent = title;
      subEl().textContent = sub;
      overlay().classList.toggle("hidden", !show);
    }

    function reset() {
      scores = { you: 0, opp: 0 };
      $("#curveYou").textContent = "0";
      $("#curveOpp").textContent = "0";
      paddle.vxp = 0;
      paddle.vyp = 0;
      lastPaddle = { x: paddle.x, y: paddle.y, t: 0 };
      phase = "idle";
      setOverlay("Click to start", `First to ${WIN_SCORE} wins.`, true);
    }

    function startServe(dir) {
      ball.sx = 0;
      ball.sy = 0;
      ball.vx = (Math.random() - 0.5) * 0.0002;
      ball.vy = (Math.random() - 0.5) * 0.0002;
      if (dir > 0) {
        // You serve: ball starts at your paddle (Flash: line up, then click).
        ball.x = clamp(paddle.x, -W + BALL_R, W - BALL_R);
        ball.y = clamp(paddle.y, -H + BALL_R, H - BALL_R);
        ball.z = 0.06;
        ball.vz = effBaseVz() * 1.02;
      } else {
        // Opponent serves toward you from their end.
        ball.x = clamp(ai.x, -W + BALL_R, W - BALL_R);
        ball.y = clamp(ai.y, -H + BALL_R, H - BALL_R);
        ball.z = 0.94;
        ball.vz = -effBaseVz() * 1.02;
      }
      serveDir = dir;
      serveAt = performance.now();
      phase = "serving";
    }

    /* ---- projection ---- */
    function project(x, y, z) {
      const f = 1 / (1 + z * 1.6);
      const cw = canvas().width, ch = canvas().height;
      return { x: cw / 2 + x * f * cw * 0.46, y: ch / 2 + y * f * ch * 0.46, scale: f };
    }

    /* ---- drawing ---- */
    function drawCourt() {
      const ctx = canvas().getContext("2d");
      const cw = canvas().width, ch = canvas().height;

      // Background gradient.
      const g = ctx.createLinearGradient(0, 0, 0, ch);
      g.addColorStop(0, "#0a0e1a");
      g.addColorStop(1, "#1a1f2e");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, cw, ch);

      // Tunnel walls — a series of inset rectangles for depth.
      ctx.lineCap = "round";
      for (let i = 8; i >= 0; i--) {
        const z = i / 8;
        const tl = project(-W, -H, z);
        const tr = project(W, -H, z);
        const br = project(W, H, z);
        const bl = project(-W, H, z);
        const alpha = 0.07 + (1 - z) * 0.18;
        ctx.strokeStyle = `rgba(124, 58, 237, ${alpha.toFixed(3)})`;
        ctx.lineWidth = 1 + (1 - z) * 1.2;
        ctx.beginPath();
        ctx.moveTo(tl.x, tl.y);
        ctx.lineTo(tr.x, tr.y);
        ctx.lineTo(br.x, br.y);
        ctx.lineTo(bl.x, bl.y);
        ctx.closePath();
        ctx.stroke();
      }

      // Diagonals: corners of front to corners of back.
      const fa = [project(-W, -H, 0), project(W, -H, 0), project(W, H, 0), project(-W, H, 0)];
      const ba = [project(-W, -H, 1), project(W, -H, 1), project(W, H, 1), project(-W, H, 1)];
      ctx.strokeStyle = "rgba(34, 211, 238, 0.18)";
      ctx.lineWidth = 1;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(fa[i].x, fa[i].y);
        ctx.lineTo(ba[i].x, ba[i].y);
        ctx.stroke();
      }
    }

    function drawPaddle(p, z, color) {
      const ctx = canvas().getContext("2d");
      const tl = project(p.x - PADDLE_W / 2, p.y - PADDLE_H / 2, z);
      const tr = project(p.x + PADDLE_W / 2, p.y - PADDLE_H / 2, z);
      const br = project(p.x + PADDLE_W / 2, p.y + PADDLE_H / 2, z);
      const bl = project(p.x - PADDLE_W / 2, p.y + PADDLE_H / 2, z);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(tl.x, tl.y);
      ctx.lineTo(tr.x, tr.y);
      ctx.lineTo(br.x, br.y);
      ctx.lineTo(bl.x, bl.y);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.55)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    function drawBall() {
      const ctx = canvas().getContext("2d");
      const p = project(ball.x, ball.y, ball.z);
      const r = Math.max(2, BALL_R * p.scale * canvas().width * 0.5);
      // Shadow on the floor.
      const shadow = project(ball.x, H, ball.z);
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.beginPath();
      ctx.ellipse(shadow.x, shadow.y, r * 1.1, r * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
      // Ball.
      const grad = ctx.createRadialGradient(p.x - r / 2, p.y - r / 2, r * 0.1, p.x, p.y, r);
      grad.addColorStop(0, "#fff7c2");
      grad.addColorStop(0.5, "#fbbf24");
      grad.addColorStop(1, "#a16207");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    function render() {
      drawCourt();
      // Far paddle first (opponent), then ball, then near paddle so layering matches z order.
      drawPaddle(ai, 1, "rgba(34, 211, 238, 0.85)");
      drawBall();
      drawPaddle(paddle, 0, "rgba(124, 58, 237, 0.85)");
    }

    /* ---- physics ---- */
    function update(dt) {
      if (phase !== "playing" && phase !== "serving") return;
      if (dt <= 0) return;

      const sd = Math.pow(SPIN_DECAY, dt / 16.67);
      ball.sx *= sd;
      ball.sy *= sd;

      const vzA = ball.vz || 1e-8;
      ball.vx += ball.sx * CURVE_ACCEL * dt + ball.sy * (-vzA) * MAGNUS * dt;
      ball.vy += ball.sy * CURVE_ACCEL * dt + ball.sx * vzA * MAGNUS * dt;

      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;
      ball.z += ball.vz * dt;

      if (ball.x < -W + BALL_R) {
        ball.x = -W + BALL_R;
        ball.vx = Math.abs(ball.vx) * 0.96;
        ball.sx *= -0.4;
        ball.sy *= 0.85;
      }
      if (ball.x > W - BALL_R) {
        ball.x = W - BALL_R;
        ball.vx = -Math.abs(ball.vx) * 0.96;
        ball.sx *= -0.4;
        ball.sy *= 0.85;
      }
      if (ball.y < -H + BALL_R) {
        ball.y = -H + BALL_R;
        ball.vy = Math.abs(ball.vy) * 0.96;
        ball.sy *= -0.4;
        ball.sx *= 0.85;
      }
      if (ball.y > H - BALL_R) {
        ball.y = H - BALL_R;
        ball.vy = -Math.abs(ball.vy) * 0.96;
        ball.sy *= -0.4;
        ball.sx *= 0.85;
      }

      const aix0 = ai.x;
      const aiy0 = ai.y;
      const aiSp = (0.006 + 0.014 * (1 - ball.z)) * effAiSp();
      ai.x += clamp(ball.x - ai.x, -aiSp * dt, aiSp * dt);
      ai.y += clamp(ball.y - ai.y, -aiSp * dt, aiSp * dt);
      ai.vxp = (ai.x - aix0) / dt;
      ai.vyp = (ai.y - aiy0) / dt;

      if (ball.z >= 1 && ball.vz > 0) {
        ball.z = 1;
        const dx = ball.x - ai.x;
        const dy = ball.y - ai.y;
        if (Math.abs(dx) <= PADDLE_W / 2 && Math.abs(dy) <= PADDLE_H / 2) {
          const nx = dx / (PADDLE_W / 2);
          const ny = dy / (PADDLE_H / 2);
          const kick = 0.00115;
          ball.vz = -Math.abs(ball.vz) * 1.035;
          ball.vx = -ball.vx * 0.32 + nx * kick * 4.2;
          ball.vy = -ball.vy * 0.32 + ny * kick * 4.2;
          ball.sx = clamp(nx * 2.0 + ai.vxp * 42, -4.5, 4.5);
          ball.sy = clamp(ny * 2.0 + ai.vyp * 42, -4.5, 4.5);
          phase = "playing";
        } else {
          score("you");
        }
      }

      if (ball.z <= 0 && ball.vz < 0) {
        ball.z = 0;
        const dx = ball.x - paddle.x;
        const dy = ball.y - paddle.y;
        if (Math.abs(dx) <= PADDLE_W / 2 && Math.abs(dy) <= PADDLE_H / 2) {
          const nx = dx / (PADDLE_W / 2);
          const ny = dy / (PADDLE_H / 2);
          const kick = 0.00135;
          ball.vz = Math.abs(ball.vz) * 1.035;
          ball.vx = nx * kick * 4.8 - ball.vx * 0.22;
          ball.vy = ny * kick * 4.8 - ball.vy * 0.22;
          ball.sx = clamp(nx * 2.4 + paddle.vxp * 48, -5, 5);
          ball.sy = clamp(ny * 2.4 + paddle.vyp * 48, -5, 5);
          phase = "playing";
        } else {
          score("opp");
        }
      }

      const mv = effMaxV();
      ball.vx = clamp(ball.vx, -mv, mv);
      ball.vy = clamp(ball.vy, -mv, mv);
      ball.vz = clamp(ball.vz, -mv, mv);
    }

    function score(who) {
      if (who === "you") scores.you++;
      else scores.opp++;
      $("#curveYou").textContent = String(scores.you);
      $("#curveOpp").textContent = String(scores.opp);
      if (scores.you >= WIN_SCORE || scores.opp >= WIN_SCORE) {
        phase = "over";
        const win = scores.you > scores.opp;
        setOverlay(win ? "You win! 🏆" : "Opponent wins.", "Click to play again.", true);
      } else {
        // Quick reset; ball goes toward whoever just lost.
        const dir = who === "you" ? -1 : 1; // who lost = receives next serve
        startServe(dir);
        phase = "serving";
      }
    }

    function clamp(x, lo, hi) {
      return x < lo ? lo : x > hi ? hi : x;
    }

    /* ---- input ---- */
    function attachMouse() {
      if (mouseAttached) return;
      mouseAttached = true;
      const c = canvas();
      c.addEventListener("mousemove", (e) => {
        const r = c.getBoundingClientRect();
        const mx = (e.clientX - r.left) / r.width;
        const my = (e.clientY - r.top) / r.height;
        const t = performance.now();
        const nx = clamp((mx - 0.5) * 2 * W, -W, W);
        const ny = clamp((my - 0.5) * 2 * H, -H, H);
        if (lastPaddle.t > 0) {
          const dtm = Math.max(1, t - lastPaddle.t);
          paddle.vxp = (nx - paddle.x) / dtm;
          paddle.vyp = (ny - paddle.y) / dtm;
        }
        lastPaddle = { x: nx, y: ny, t };
        paddle.x = nx;
        paddle.y = ny;
      });
      c.addEventListener("click", () => {
        if (phase === "idle" || phase === "over") {
          scores = { you: 0, opp: 0 };
          $("#curveYou").textContent = "0";
          $("#curveOpp").textContent = "0";
          paddle.vxp = 0;
          paddle.vyp = 0;
          lastPaddle = { x: paddle.x, y: paddle.y, t: 0 };
          startServe(1);
          setOverlay("", "", false);
        }
      });
    }

    function loop(t) {
      const dt = lastFrame ? Math.min(40, t - lastFrame) : 16;
      lastFrame = t;
      // Only update / render when the panel is visible (saves CPU).
      if (panelActive()) {
        update(dt);
        render();
      }
      requestAnimationFrame(loop);
    }

    function init() {
      attachMouse();
      const sel = document.getElementById("curveballDiff");
      if (sel) {
        const d = curveDiff();
        sel.value = String(d);
        sel.addEventListener("change", () => {
          const v = parseInt(sel.value, 10);
          store.set(CB_DIFF_KEY, v >= 1 && v <= 5 ? v : 3);
        });
      }
      reset();
      lastFrame = 0;
      requestAnimationFrame(loop);
    }

    return { init };
  })();

  /* ============================================================
     KLONDIKE SOLITAIRE
     Drag cards (or stacks) to move them. Click selects, click again
     drops. Double-click sends a card to its foundation. Easy mode
     deals 1 card from the stock; Hard mode deals 3 (only the top
     card of the waste fan is in play).
     ============================================================ */
  const Solitaire = (() => {
    const SUITS = ["S", "H", "D", "C"];
    const SUIT_GLYPHS = { S: "\u2660", H: "\u2665", D: "\u2666", C: "\u2663" };
    const RANK_LABELS = { 1: "A", 11: "J", 12: "Q", 13: "K" };
    const WINS_KEY = "bic.sol.wins";
    const DRAW_KEY = "bic.sol.draw";
    const DRAG_THRESHOLD = 6;     // pixels before a press becomes a drag
    const STEP_DOWN = 14;         // tableau face-down spacing
    const STEP_UP = 28;           // tableau face-up spacing
    const FAN_OFFSET = 24;        // horizontal spacing between fanned waste cards

    const rankLabel = (r) => RANK_LABELS[r] || String(r);
    const isRed = (suit) => suit === "H" || suit === "D";

    let state = null;       // { stock, waste, foundations:{S,H,D,C}, tableau:[7] }
    let selected = null;    // { kind, col?, idx?, suit? }
    let moves = 0;
    let wins = store.get(WINS_KEY, 0);
    let won = false;
    let drawCount = store.get(DRAW_KEY, 1);
    if (drawCount !== 1 && drawCount !== 3) drawCount = 1;

    // Drag state.
    let drag = null;

    function newDeck() {
      const d = [];
      for (const s of SUITS) {
        for (let r = 1; r <= 13; r++) d.push({ rank: r, suit: s, faceUp: false });
      }
      for (let i = d.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [d[i], d[j]] = [d[j], d[i]];
      }
      return d;
    }

    function newGame() {
      const deck = newDeck();
      const tableau = [[], [], [], [], [], [], []];
      for (let col = 0; col < 7; col++) {
        for (let row = 0; row <= col; row++) {
          const c = deck.pop();
          if (row === col) c.faceUp = true;
          tableau[col].push(c);
        }
      }
      state = {
        stock: deck,
        waste: [],
        foundations: { S: [], H: [], D: [], C: [] },
        tableau,
      };
      selected = null;
      moves = 0;
      won = false;
      setStatus("");
      render();
    }

    function setStatus(msg, cls) {
      const s = $("#solStatus");
      if (!s) return;
      s.textContent = msg;
      s.className = "sol-status" + (cls ? " " + cls : "");
    }

    function isWin() {
      return SUITS.every((s) => state.foundations[s].length === 13);
    }

    function canPlaceTableau(card, col) {
      const pile = state.tableau[col];
      if (pile.length === 0) return card.rank === 13;
      const top = pile[pile.length - 1];
      if (!top.faceUp) return false;
      return isRed(top.suit) !== isRed(card.suit) && top.rank === card.rank + 1;
    }

    function canPlaceFoundation(card, suit) {
      if (card.suit !== suit) return false;
      const pile = state.foundations[suit];
      if (pile.length === 0) return card.rank === 1;
      return pile[pile.length - 1].rank === card.rank - 1;
    }

    function getStack(src) {
      if (src.kind === "waste") {
        const w = state.waste;
        return w.length ? [w[w.length - 1]] : [];
      }
      if (src.kind === "foundation") {
        const f = state.foundations[src.suit];
        return f.length ? [f[f.length - 1]] : [];
      }
      if (src.kind === "tableau") {
        const p = state.tableau[src.col];
        if (src.idx == null || src.idx >= p.length) return [];
        if (!p[src.idx].faceUp) return [];
        return p.slice(src.idx);
      }
      return [];
    }

    function removeStack(src, n) {
      if (src.kind === "waste") {
        state.waste.pop();
      } else if (src.kind === "foundation") {
        state.foundations[src.suit].pop();
      } else if (src.kind === "tableau") {
        state.tableau[src.col].splice(src.idx, n);
        // Auto-flip the new top card if face-down.
        const p = state.tableau[src.col];
        if (p.length > 0 && !p[p.length - 1].faceUp) p[p.length - 1].faceUp = true;
      }
    }

    function tryMove(src, dst) {
      if (sameSource(src, dst)) return false;
      const stack = getStack(src);
      if (stack.length === 0) return false;

      if (dst.kind === "foundation") {
        if (stack.length !== 1) return false;
        if (!canPlaceFoundation(stack[0], dst.suit)) return false;
        state.foundations[dst.suit].push(stack[0]);
        removeStack(src, 1);
        moves++;
        return true;
      }
      if (dst.kind === "tableau") {
        if (!canPlaceTableau(stack[0], dst.col)) return false;
        state.tableau[dst.col].push(...stack);
        removeStack(src, stack.length);
        moves++;
        return true;
      }
      return false;
    }

    function dealStock() {
      if (won) return;
      if (state.stock.length === 0) {
        // Recycle waste back into the deck.
        while (state.waste.length > 0) {
          const c = state.waste.pop();
          c.faceUp = false;
          state.stock.push(c);
        }
      } else {
        const n = Math.min(drawCount, state.stock.length);
        for (let i = 0; i < n; i++) {
          const c = state.stock.pop();
          c.faceUp = true;
          state.waste.push(c);
        }
      }
      moves++;
      selected = null;
      render();
    }

    function sameSource(a, b) {
      if (!a || !b) return false;
      if (a.kind !== b.kind) return false;
      if (a.kind === "tableau") return a.col === b.col && a.idx === b.idx;
      if (a.kind === "foundation") return a.suit === b.suit;
      return true;
    }

    function selectionContains(src) {
      // Highlight every card from selected.idx down through end of pile.
      if (!selected) return false;
      if (selected.kind !== src.kind) return false;
      if (src.kind === "tableau")
        return selected.col === src.col && selected.idx <= src.idx;
      if (src.kind === "foundation") return selected.suit === src.suit;
      return true;
    }

    function clickSrc(src) {
      if (won) return;
      if (selected) {
        if (sameSource(selected, src)) {
          selected = null;
          render();
          return;
        }
        if (tryMove(selected, src)) {
          selected = null;
          if (isWin()) doWin();
          render();
          return;
        }
        // Move failed — try selecting the new src instead.
        const stack = getStack(src);
        selected = stack.length > 0 ? src : null;
        render();
        return;
      }
      const stack = getStack(src);
      if (stack.length === 0) return;
      selected = src;
      render();
    }

    function dblClickSrc(src) {
      if (won) return;
      const stack = getStack(src);
      if (stack.length !== 1) return;
      const card = stack[0];
      if (canPlaceFoundation(card, card.suit)) {
        tryMove(src, { kind: "foundation", suit: card.suit });
        selected = null;
        if (isWin()) doWin();
        render();
      }
    }

    function doWin() {
      won = true;
      wins++;
      store.set(WINS_KEY, wins);
      setStatus(`You won in ${moves} moves!`, "win");
    }

    function makeCardEl(card) {
      const el = document.createElement("div");
      el.className = "sol-card";
      if (!card.faceUp) {
        el.classList.add("face-down");
        return el;
      }
      if (isRed(card.suit)) el.classList.add("red");
      const r = rankLabel(card.rank);
      const s = SUIT_GLYPHS[card.suit];
      el.innerHTML =
        `<div class="sol-corner"><div class="sol-rank">${r}</div>` +
        `<div class="sol-suit">${s}</div></div>` +
        `<div class="sol-big">${s}</div>`;
      return el;
    }

    function makeEmptyEl(extraClass, glyph) {
      const e = document.createElement("div");
      e.className = "sol-empty" + (extraClass ? " " + extraClass : "");
      if (glyph) e.textContent = glyph;
      return e;
    }

    /* ---------- pointer / drag handling ---------- */

    // After a drag-drop, the browser still fires a click on whatever's
    // under the cursor; this swallows that single click everywhere on the
    // page so the drop doesn't double as a click on stock/foundations.
    function suppressNextClick() {
      const handler = (e) => {
        e.stopPropagation();
        e.preventDefault();
        document.removeEventListener("click", handler, true);
        clearTimeout(timer);
      };
      document.addEventListener("click", handler, true);
      const timer = setTimeout(() => {
        document.removeEventListener("click", handler, true);
      }, 250);
    }

    // Wires both click+dblclick (for click-to-move) and pointerdown (for
    // drag) on a card. `stackEls` is the array of card elements that move
    // together; for tableau, that's every face-up card from src.idx to
    // the bottom of the column.
    function attachInteractions(el, src, stackEls) {
      el.addEventListener("pointerdown", (e) => onPointerDown(e, src, stackEls));
      el.addEventListener("click", () => clickSrc(src));
      el.addEventListener("dblclick", () => dblClickSrc(src));
    }

    function onPointerDown(e, src, stackEls) {
      if (won) return;
      if (e.button !== undefined && e.button !== 0) return;
      const stack = getStack(src);
      if (stack.length === 0) return;

      const target = e.currentTarget;
      const rect = target.getBoundingClientRect();

      drag = {
        src,
        stack,
        stackEls,
        startX: e.clientX,
        startY: e.clientY,
        offsetX: e.clientX - rect.left,
        offsetY: e.clientY - rect.top,
        cardWidth: rect.width,
        cardHeight: rect.height,
        started: false,
        ghost: null,
      };

      document.addEventListener("pointermove", onPointerMove);
      document.addEventListener("pointerup", onPointerUp);
      document.addEventListener("pointercancel", onPointerUp);
    }

    function onPointerMove(e) {
      if (!drag) return;
      if (!drag.started) {
        const dx = e.clientX - drag.startX;
        const dy = e.clientY - drag.startY;
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
        beginDrag();
      }
      drag.ghost.style.left = `${e.clientX - drag.offsetX}px`;
      drag.ghost.style.top = `${e.clientY - drag.offsetY}px`;
    }

    function beginDrag() {
      drag.started = true;
      drag.ghost = makeGhost(drag.stack, drag.cardWidth, drag.cardHeight);
      document.body.appendChild(drag.ghost);
      drag.stackEls.forEach((el) => el && el.classList.add("dragging"));
    }

    function onPointerUp(e) {
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("pointercancel", onPointerUp);
      if (!drag) return;

      if (!drag.started) {
        // Treated as a click — the click event will fire normally.
        drag = null;
        return;
      }

      // Real drag — find a drop target.
      const elBelow = document.elementFromPoint(e.clientX, e.clientY);
      const dst = findDropTarget(elBelow);

      if (drag.ghost) drag.ghost.remove();
      drag.stackEls.forEach((el) => el && el.classList.remove("dragging"));

      let moved = false;
      if (dst) moved = tryMove(drag.src, dst);
      if (moved) {
        selected = null;
        if (isWin()) doWin();
      }
      drag = null;
      // Swallow the synthetic click that would otherwise fire on the
      // element under the cursor (e.g. the stock or a foundation slot).
      suppressNextClick();
      render();
    }

    function makeGhost(stack, w, h) {
      const ghost = document.createElement("div");
      ghost.className = "sol-drag";
      ghost.style.width = `${w}px`;
      let top = 0;
      stack.forEach((card) => {
        const el = makeCardEl(card);
        el.style.position = "absolute";
        el.style.top = `${top}px`;
        el.style.left = "0";
        el.style.width = `${w}px`;
        el.style.height = `${h}px`;
        el.style.aspectRatio = "auto";
        ghost.appendChild(el);
        top += STEP_UP;
      });
      ghost.style.height = `${top - STEP_UP + h}px`;
      return ghost;
    }

    function findDropTarget(el) {
      while (el && el !== document.body) {
        if (el.classList && el.classList.contains("sol-col")) {
          return { kind: "tableau", col: parseInt(el.dataset.col, 10) };
        }
        if (el.id && typeof el.id === "string" && el.id.startsWith("solFound")) {
          return { kind: "foundation", suit: el.id.slice(-1) };
        }
        el = el.parentElement;
      }
      return null;
    }

    /* ---------- rendering ---------- */

    function render() {
      $("#solMoves").textContent = String(moves);
      $("#solWins").textContent = String(wins);
      const modeBtn = $("#solModeBtn");
      if (modeBtn) modeBtn.textContent = drawCount === 1 ? "Easy \u00b7 draw 1" : "Hard \u00b7 draw 3";

      // ----- Stock -----
      const stockEl = $("#solStock");
      stockEl.innerHTML = "";
      if (state.stock.length > 0) {
        const c = makeCardEl({ rank: 0, suit: "S", faceUp: false });
        c.addEventListener("click", dealStock);
        stockEl.appendChild(c);
      } else {
        const e = makeEmptyEl(state.waste.length > 0 ? "recycle" : "");
        e.addEventListener("click", dealStock);
        stockEl.appendChild(e);
      }

      // ----- Waste -----
      const wasteEl = $("#solWaste");
      wasteEl.innerHTML = "";
      const w = state.waste;
      if (w.length > 0) {
        const visible = drawCount === 3 ? Math.min(3, w.length) : 1;
        const start = w.length - visible;
        for (let i = 0; i < visible; i++) {
          const idx = start + i;
          const isTop = idx === w.length - 1;
          const c = makeCardEl(w[idx]);
          if (drawCount === 3) c.style.left = `${i * FAN_OFFSET}px`;
          c.style.zIndex = String(10 + i);
          if (isTop) {
            const src = { kind: "waste" };
            if (selected && sameSource(selected, src)) c.classList.add("selected");
            attachInteractions(c, src, [c]);
          } else {
            c.style.pointerEvents = "none";
            c.style.cursor = "default";
          }
          wasteEl.appendChild(c);
        }
      } else {
        wasteEl.appendChild(makeEmptyEl());
      }

      // ----- Foundations -----
      for (const s of SUITS) {
        const el = $(`#solFound${s}`);
        el.innerHTML = "";
        const pile = state.foundations[s];
        const src = { kind: "foundation", suit: s };
        if (pile.length > 0) {
          const c = makeCardEl(pile[pile.length - 1]);
          if (selected && sameSource(selected, src)) c.classList.add("selected");
          attachInteractions(c, src, [c]);
          el.appendChild(c);
        } else {
          const e = makeEmptyEl(isRed(s) ? "red" : "", SUIT_GLYPHS[s]);
          e.addEventListener("click", () => clickSrc(src));
          el.appendChild(e);
        }
      }

      // ----- Tableau -----
      let maxColPx = 0;
      for (let col = 0; col < 7; col++) {
        const colEl = document.querySelector(`.sol-col[data-col="${col}"]`);
        colEl.innerHTML = "";
        colEl.style.minHeight = "";
        const pile = state.tableau[col];
        if (pile.length === 0) {
          const e = makeEmptyEl();
          const src = { kind: "tableau", col };
          e.addEventListener("click", () => clickSrc(src));
          colEl.appendChild(e);
        } else {
          // First pass: build elements and lay them out vertically.
          const cardEls = [];
          let top = 0;
          pile.forEach((card) => {
            const c = makeCardEl(card);
            c.style.top = `${top}px`;
            top += card.faceUp ? STEP_UP : STEP_DOWN;
            cardEls.push(c);
            colEl.appendChild(c);
          });
          // Second pass: wire interactions for face-up cards. The drag
          // moves the clicked card plus everything below it.
          pile.forEach((card, idx) => {
            if (!card.faceUp) return;
            const src = { kind: "tableau", col, idx };
            const el = cardEls[idx];
            if (selectionContains(src)) el.classList.add("selected");
            attachInteractions(el, src, cardEls.slice(idx));
          });
          maxColPx = Math.max(maxColPx, top);
        }
      }
      const baseHeight = Math.max(200, maxColPx + 110);
      $$(".sol-col").forEach((c) => (c.style.minHeight = `${baseHeight}px`));
    }

    function toggleMode() {
      drawCount = drawCount === 1 ? 3 : 1;
      store.set(DRAW_KEY, drawCount);
      newGame();
    }

    function init() {
      const newBtn = $("#solNewBtn");
      if (!newBtn) return;
      newBtn.addEventListener("click", newGame);
      const modeBtn = $("#solModeBtn");
      if (modeBtn) modeBtn.addEventListener("click", toggleMode);

      // A click on the empty area of a tableau column (below the cards)
      // should still target that column as a drop destination.
      $$(".sol-col").forEach((colEl) => {
        const col = parseInt(colEl.dataset.col, 10);
        colEl.addEventListener("click", (e) => {
          if (e.target !== colEl) return;
          clickSrc({ kind: "tableau", col });
        });
      });

      newGame();
    }

    return { init };
  })();

  /* ============================================================
     SPIDER SOLITAIRE
     Two decks, 10 columns, same-suit descending runs, 8 full suits
     to clear. Stock deals 10 at a time when no column is empty.
     ============================================================ */
  const Spider = (() => {
    const SUITS = ["S", "H", "D", "C"];
    const SUIT_GLYPHS = { S: "\u2660", H: "\u2665", D: "\u2666", C: "\u2663" };
    const RANK_LABELS = { 1: "A", 11: "J", 12: "Q", 13: "K" };
    const WINS_KEY = "bic.spider.wins";
    const DRAG_THRESHOLD = 6;
    const STEP_DOWN = 12;
    const STEP_UP = 24;

    const rankLabel = (r) => RANK_LABELS[r] || String(r);
    const isRed = (suit) => suit === "H" || suit === "D";

    let state = null;
    /** @type {{ kind: "tableau", col: number, idx: number } | null} */
    let selected = null;
    let moves = 0;
    let wins = store.get(WINS_KEY, 0);
    let won = false;
    let drag = null;

    function newDoubleDeck() {
      const d = [];
      for (let dbl = 0; dbl < 2; dbl += 1) {
        for (const s of SUITS) {
          for (let r = 1; r <= 13; r += 1) d.push({ rank: r, suit: s, faceUp: false });
        }
      }
      for (let i = d.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [d[i], d[j]] = [d[j], d[i]];
      }
      return d;
    }

    function newGame() {
      const deck = newDoubleDeck();
      const tableau = Array.from({ length: 10 }, () => []);
      let di = 0;
      for (let col = 0; col < 10; col += 1) {
        const h = col < 4 ? 6 : 5;
        for (let r = 0; r < h; r += 1) {
          const c = deck[di];
          di += 1;
          c.faceUp = r === h - 1;
          tableau[col].push(c);
        }
      }
      const stock = deck.slice(di);
      state = { tableau, stock, completedSuits: [] };
      selected = null;
      moves = 0;
      won = false;
      setStatus("");
      render();
    }

    function setStatus(msg, cls) {
      const s = $("#spiStatus");
      if (!s) return;
      s.textContent = msg;
      s.className = "sol-status" + (cls ? ` ${cls}` : "");
    }

    function isWin() {
      return state && state.completedSuits.length === 8;
    }

    /** Valid descending same-suit run from startIdx through end of pile (pile[0] = top) */
    function isValidRunFrom(pile, startIdx) {
      if (startIdx < 0 || startIdx >= pile.length) return false;
      for (let i = startIdx; i < pile.length - 1; i += 1) {
        const a = pile[i];
        const b = pile[i + 1];
        if (!a.faceUp || !b.faceUp) return false;
        if (a.suit !== b.suit || a.rank !== b.rank + 1) return false;
      }
      return true;
    }

    function getStack(src) {
      if (src.kind !== "tableau" || src.idx == null) return [];
      const p = state.tableau[src.col];
      if (src.idx >= p.length) return [];
      if (!p[src.idx].faceUp) return [];
      if (!isValidRunFrom(p, src.idx)) return [];
      return p.slice(src.idx);
    }

    function canPlaceOn(stack, col) {
      if (stack.length === 0) return false;
      const first = stack[0];
      const dest = state.tableau[col];
      if (dest.length === 0) {
        // Card that becomes the new column top must be a king
        return first.rank === 13;
      }
      const b = dest[dest.length - 1];
      if (!b.faceUp) return false;
      return b.suit === first.suit && b.rank === first.rank + 1;
    }

    function removeTableau(src, n) {
      const p = state.tableau[src.col];
      p.splice(src.idx, n);
      if (p.length > 0 && !p[p.length - 1].faceUp) p[p.length - 1].faceUp = true;
    }

    function tryMove(src, dst) {
      if (dst.kind === "tableau" && sameSourceTableau(src, dst)) return false;
      const stack = getStack(src);
      if (stack.length === 0) return false;
      if (dst.kind !== "tableau") return false;
      if (!canPlaceOn(stack, dst.col)) return false;
      state.tableau[dst.col].push(...stack);
      removeTableau(src, stack.length);
      moves += 1;
      tryRemoveSuits();
      if (isWin()) doWin();
      return true;
    }

    function tryRemoveSuits() {
      if (!state) return;
      let again = true;
      while (again) {
        again = false;
        for (let col = 0; col < 10; col += 1) {
          const p = state.tableau[col];
          if (p.length < 13) continue;
          const slice = p.slice(-13);
          if (!slice.every((c) => c.faceUp)) continue;
          const s0 = slice[0].suit;
          if (!slice.every((c) => c.suit === s0)) continue;
          let ok = true;
          for (let i = 0; i < 13; i += 1) {
            if (slice[i].rank !== 13 - i) {
              ok = false;
              break;
            }
          }
          if (!ok) continue;
          p.splice(-13, 13);
          state.completedSuits.push(s0);
          moves += 1;
          if (p.length > 0 && !p[p.length - 1].faceUp) p[p.length - 1].faceUp = true;
          again = true;
          break;
        }
      }
    }

    function dealStock() {
      if (won || !state) return;
      if (state.stock.length < 10) {
        setStatus("No more cards in stock.");
        return;
      }
      for (let c = 0; c < 10; c += 1) {
        if (state.tableau[c].length === 0) {
          setStatus("Each column must have a card before you can deal from stock.");
          return;
        }
      }
      for (let c = 0; c < 10; c += 1) {
        const card = state.stock.pop();
        card.faceUp = true;
        state.tableau[c].push(card);
      }
      moves += 1;
      setStatus("");
      tryRemoveSuits();
      if (isWin()) doWin();
      selected = null;
      render();
    }

    function doWin() {
      won = true;
      wins += 1;
      store.set(WINS_KEY, wins);
      setStatus(`You won in ${moves} moves!`, "win");
    }

    function sameSource(a, b) {
      if (!a || !b) return false;
      return a.kind === b.kind && a.col === b.col && a.idx === b.idx;
    }

    function sameSourceTableau(a, b) {
      if (!a || b.kind !== "tableau" || a.kind !== "tableau") return false;
      return a.col === b.col;
    }

    function selectionContains(src) {
      if (!selected) return false;
      if (selected.kind !== "tableau" || src.kind !== "tableau") return false;
      return selected.col === src.col && selected.idx != null && src.idx != null && selected.idx <= src.idx;
    }

    function makeCardEl(card) {
      const el = document.createElement("div");
      el.className = "sol-card";
      if (!card.faceUp) {
        el.classList.add("face-down");
        return el;
      }
      if (isRed(card.suit)) el.classList.add("red");
      const r = rankLabel(card.rank);
      const s = SUIT_GLYPHS[card.suit];
      el.innerHTML =
        `<div class="sol-corner"><div class="sol-rank">${r}</div>` +
        `<div class="sol-suit">${s}</div></div>` +
        `<div class="sol-big">${s}</div>`;
      return el;
    }

    function makeEmptyEl(extra) {
      const e = document.createElement("div");
      e.className = "sol-empty" + (extra ? ` ${extra}` : "");
      return e;
    }

    function suppressNextClick() {
      const handler = (e) => {
        e.stopPropagation();
        e.preventDefault();
        document.removeEventListener("click", handler, true);
        clearTimeout(timer);
      };
      document.addEventListener("click", handler, true);
      const timer = setTimeout(() => {
        document.removeEventListener("click", handler, true);
      }, 250);
    }

    function attachDragOnly(el, src, stackEls) {
      el.addEventListener("pointerdown", (e) => onPointerDown(e, src, stackEls));
    }

    function clickSrc(src) {
      if (won) return;
      if (src.kind === "tableau" && (src.idx == null || !Number.isFinite(src.idx))) {
        if (selected) {
          if (tryMove(selected, { kind: "tableau", col: src.col })) {
            selected = null;
            render();
            return;
          }
        }
        return;
      }
      if (selected) {
        if (sameSource(selected, src)) {
          selected = null;
          render();
          return;
        }
        if (tryMove(selected, { kind: "tableau", col: src.col })) {
          selected = null;
          render();
          return;
        }
        const st = getStack(src);
        selected = st.length > 0 ? { kind: "tableau", col: src.col, idx: src.idx } : null;
        render();
        return;
      }
      const st = getStack(src);
      if (st.length === 0) return;
      selected = { kind: "tableau", col: src.col, idx: src.idx };
      render();
    }

    function onPointerDown(e, src, stackEls) {
      if (won) return;
      if (e.button !== 0) return;
      if (src.idx == null) return;
      const stack = getStack(src);
      if (stack.length === 0) return;
      const target = e.currentTarget;
      const rect = target.getBoundingClientRect();
      drag = {
        src,
        stack,
        stackEls,
        startX: e.clientX,
        startY: e.clientY,
        offsetX: e.clientX - rect.left,
        offsetY: e.clientY - rect.top,
        cardWidth: rect.width,
        cardHeight: rect.height,
        started: false,
        ghost: null,
      };
      document.addEventListener("pointermove", onPointerMove);
      document.addEventListener("pointerup", onPointerUp);
      document.addEventListener("pointercancel", onPointerUp);
    }

    function onPointerMove(e) {
      if (!drag) return;
      if (!drag.started) {
        const dx = e.clientX - drag.startX;
        const dy = e.clientY - drag.startY;
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
        beginDrag();
      }
      if (drag.ghost) {
        drag.ghost.style.left = `${e.clientX - drag.offsetX}px`;
        drag.ghost.style.top = `${e.clientY - drag.offsetY}px`;
      }
    }

    function beginDrag() {
      if (!drag) return;
      drag.started = true;
      drag.ghost = makeGhost(drag.stack, drag.cardWidth, drag.cardHeight);
      document.body.appendChild(drag.ghost);
      drag.stackEls.forEach((el) => el && el.classList.add("dragging"));
    }

    function onPointerUp(e) {
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("pointercancel", onPointerUp);
      if (!drag) return;
      if (!drag.started) {
        drag = null;
        return;
      }
      const elBelow = document.elementFromPoint(e.clientX, e.clientY);
      const dst = findDropTarget(elBelow);
      if (drag.ghost) drag.ghost.remove();
      drag.stackEls.forEach((el) => el && el.classList.remove("dragging"));
      let moved = false;
      if (dst) moved = tryMove(drag.src, dst);
      if (moved) selected = null;
      drag = null;
      suppressNextClick();
      render();
    }

    function makeGhost(stack, w, h) {
      const ghost = document.createElement("div");
      ghost.className = "sol-drag";
      ghost.style.width = `${w}px`;
      let top = 0;
      stack.forEach((card) => {
        const el = makeCardEl(card);
        el.style.position = "absolute";
        el.style.top = `${top}px`;
        el.style.left = "0";
        el.style.width = `${w}px`;
        el.style.height = `${h}px`;
        el.style.aspectRatio = "auto";
        ghost.appendChild(el);
        top += STEP_UP;
      });
      ghost.style.height = `${top - STEP_UP + h}px`;
      return ghost;
    }

    function findDropTarget(el) {
      let n = el;
      while (n && n !== document.body) {
        if (n.classList && n.classList.contains("spider-col")) {
          return { kind: "tableau", col: parseInt(n.dataset.col, 10) };
        }
        n = n.parentElement;
      }
      return null;
    }

    function render() {
      if (!state) return;
      const mEl = $("#spiMoves");
      if (mEl) mEl.textContent = String(moves);
      const wEl = $("#spiWins");
      if (wEl) wEl.textContent = String(wins);
      const sEl = $("#spiSuits");
      if (sEl) sEl.textContent = `${state.completedSuits.length}/8`;
      const nEl = $("#spiStockN");
      if (nEl) nEl.textContent = String(state.stock.length);

      const doneEl = $("#spiCompleted");
      if (doneEl) {
        doneEl.innerHTML = "";
        for (let i = 0; i < 8; i += 1) {
          const d = document.createElement("div");
          d.className = "spi-done-slot" + (i < state.completedSuits.length ? " filled" : "");
          d.setAttribute("aria-hidden", "true");
          d.textContent = i < state.completedSuits.length ? SUIT_GLYPHS[state.completedSuits[i]] : "";
          doneEl.appendChild(d);
        }
      }

      const stockSlot = $("#spiStock");
      if (stockSlot) {
        stockSlot.innerHTML = "";
        if (state.stock.length > 0) {
          const c = makeCardEl({ rank: 0, suit: "S", faceUp: false });
          c.addEventListener("click", (ev) => {
            ev.stopPropagation();
            dealStock();
          });
          stockSlot.appendChild(c);
        } else {
          const e = makeEmptyEl("recycle");
          e.style.fontSize = "20px";
          e.title = "Stock empty";
          stockSlot.appendChild(e);
        }
      }

      let maxColPx = 0;
      for (let col = 0; col < 10; col += 1) {
        const colEl = document.querySelector(`.spider-col[data-col="${col}"]`);
        if (!colEl) continue;
        colEl.innerHTML = "";
        const pile = state.tableau[col];
        if (pile.length === 0) {
          const e = makeEmptyEl();
          e.addEventListener("click", () => clickSrc({ kind: "tableau", col, idx: null }));
          colEl.appendChild(e);
        } else {
          const cardEls = [];
          let t = 0;
          pile.forEach((card) => {
            const c = makeCardEl(card);
            c.style.top = `${t}px`;
            t += card.faceUp ? STEP_UP : STEP_DOWN;
            cardEls.push(c);
            colEl.appendChild(c);
          });
          pile.forEach((card, idx) => {
            if (!card.faceUp) return;
            const s = { kind: "tableau", col, idx };
            const el = cardEls[idx];
            if (selectionContains(s)) el.classList.add("selected");
            el.addEventListener("click", (ev) => {
              ev.stopPropagation();
              clickSrc(s);
            });
            if (isValidRunFrom(pile, idx)) attachDragOnly(el, s, cardEls.slice(idx));
          });
          maxColPx = Math.max(maxColPx, t);
        }
      }
      const baseH = Math.max(200, maxColPx + 100);
      $$(".spider-col").forEach((c) => {
        c.style.minHeight = `${baseH}px`;
      });
    }

    function init() {
      const b = $("#spiNewBtn");
      if (!b) return;
      b.addEventListener("click", newGame);
      $$(".spider-col").forEach((colEl) => {
        const col = parseInt(colEl.dataset.col, 10);
        colEl.addEventListener("click", (e) => {
          if (e.target !== colEl) return;
          clickSrc({ kind: "tableau", col, idx: null });
        });
      });
      newGame();
    }

    return { init };
  })();

  /* ============================================================
     SPADES
     Four players, two teams (you+North vs East+West). Bid the tricks
     you'll take, follow suit, spades are trump. First team to 500.
     ============================================================ */
  const Spades = (() => {
    const SUITS = ["S", "H", "D", "C"];
    const SUIT_GLYPHS = { S: "\u2660", H: "\u2665", D: "\u2666", C: "\u2663" };
    const RANK_LABELS = { 11: "J", 12: "Q", 13: "K", 14: "A" };
    const TARGET_SCORE = 500;
    const TEAM_OF = [0, 1, 0, 1]; // South+North = us; West+East = them
    const SEAT_LETTER = ["S", "W", "N", "E"];
    const SEAT_LOWER = ["s", "w", "n", "e"];
    const PLAYERS = [
      { name: "You", isHuman: true },
      { name: "West", isHuman: false },
      { name: "North", isHuman: false },
      { name: "East", isHuman: false },
    ];

    let state = null;
    // Increments on every newGame so any pending setTimeouts from a
    // previous game can no-op when the user hits "New game" mid-round.
    let runId = 0;

    function rankLabel(r) { return RANK_LABELS[r] || String(r); }
    function isRed(suit) { return suit === "H" || suit === "D"; }

    function newDeck() {
      const deck = [];
      for (const suit of SUITS) {
        for (let rank = 2; rank <= 14; rank++) deck.push({ rank, suit });
      }
      for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
      }
      return deck;
    }

    function sortHand(hand) {
      // Group by suit (S, H, D, C order) then high to low within suit.
      hand.sort((a, b) => {
        if (a.suit !== b.suit) return SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit);
        return b.rank - a.rank;
      });
    }

    function newGame() {
      runId++;
      state = {
        teams: [{ score: 0, bags: 0 }, { score: 0, bags: 0 }],
        players: PLAYERS.map((p) => ({ ...p, hand: [], bid: null, tricks: 0 })),
        dealer: 3,
        bidder: 0,
        turn: 0,
        leader: 0,
        trick: [],
        spadesBroken: false,
        phase: "bidding",
        round: 1,
        message: "",
      };
      dealHand();
      // The player to dealer's left bids first.
      state.bidder = (state.dealer + 1) % 4;
      render();
      schedule(advanceBidding, 500);
    }

    function newRound() {
      state.dealer = (state.dealer + 1) % 4;
      state.bidder = (state.dealer + 1) % 4;
      state.turn = state.bidder;
      state.leader = state.bidder;
      state.players.forEach((p) => { p.bid = null; p.tricks = 0; p.hand = []; });
      state.trick = [];
      state.spadesBroken = false;
      state.phase = "bidding";
      state.round++;
      state.message = "";
      dealHand();
      render();
      schedule(advanceBidding, 500);
    }

    function dealHand() {
      const deck = newDeck();
      for (let i = 0; i < 4; i++) {
        const hand = deck.slice(i * 13, i * 13 + 13);
        sortHand(hand);
        state.players[i].hand = hand;
      }
    }

    // schedule(fn, ms) — wraps setTimeout but checks the run id so we
    // don't fire callbacks from a previous game.
    function schedule(fn, ms) {
      const id = runId;
      setTimeout(() => { if (id === runId) fn(); }, ms);
    }

    /* ---------- bidding ---------- */

    function advanceBidding() {
      if (state.phase !== "bidding") return;
      const player = state.players[state.bidder];
      if (player.isHuman) {
        state.message = "Your bid";
        render();
        return;
      }
      const bid = botBid(player.hand);
      player.bid = bid;
      state.message = `${player.name} bids ${bid}`;
      state.bidder = (state.bidder + 1) % 4;
      if (allBidsIn()) {
        startPlaying();
        return;
      }
      render();
      schedule(advanceBidding, 750);
    }

    function placeBid(bid) {
      if (state.phase !== "bidding") return;
      const player = state.players[state.bidder];
      if (!player.isHuman) return;
      player.bid = bid;
      state.message = `You bid ${bid === 0 ? "Nil" : bid}`;
      state.bidder = (state.bidder + 1) % 4;
      if (allBidsIn()) {
        startPlaying();
        return;
      }
      render();
      schedule(advanceBidding, 500);
    }

    function allBidsIn() {
      return state.players.every((p) => p.bid !== null);
    }

    function botBid(hand) {
      const spades = hand.filter((c) => c.suit === "S").sort((a, b) => b.rank - a.rank);
      let bid = 0;
      // Top spades.
      if (spades.find((c) => c.rank === 14)) bid += 1;
      if (spades.find((c) => c.rank === 13) && spades.length >= 2) bid += 1;
      if (spades.find((c) => c.rank === 12) && spades.length >= 3) bid += 1;
      // Length tricks beyond 3 spades.
      if (spades.length > 3) bid += spades.length - 3;
      // Off-suit aces.
      for (const suit of ["H", "D", "C"]) {
        if (hand.find((c) => c.suit === suit && c.rank === 14)) bid += 1;
      }
      // Half-tricks for protected kings (round down sum/2).
      let half = 0;
      for (const suit of ["H", "D", "C"]) {
        const sCards = hand.filter((c) => c.suit === suit);
        if (sCards.find((c) => c.rank === 13) && sCards.length >= 2) half++;
      }
      bid += Math.floor(half / 2);
      return Math.max(1, Math.min(8, bid));
    }

    /* ---------- playing ---------- */

    function startPlaying() {
      state.phase = "playing";
      state.turn = (state.dealer + 1) % 4;
      state.leader = state.turn;
      state.trick = [];
      state.message = `${state.players[state.turn].name} leads`;
      render();
      schedule(advancePlaying, 700);
    }

    function advancePlaying() {
      if (state.phase !== "playing") return;
      const player = state.players[state.turn];
      if (player.isHuman) {
        state.message = "Your turn";
        render();
        return;
      }
      const card = botPlay(state.turn);
      doPlay(state.turn, card);
    }

    function humanPlay(card) {
      if (state.phase !== "playing") return;
      if (state.turn !== 0) return;
      const legals = legalPlays(0);
      if (!legals.find((c) => c.suit === card.suit && c.rank === card.rank)) return;
      doPlay(0, card);
    }

    function doPlay(playerIdx, card) {
      const player = state.players[playerIdx];
      const handIdx = player.hand.findIndex((c) => c.suit === card.suit && c.rank === card.rank);
      if (handIdx < 0) return;
      player.hand.splice(handIdx, 1);
      state.trick.push({ player: playerIdx, card });
      if (card.suit === "S") state.spadesBroken = true;
      state.message = `${player.name} played ${rankLabel(card.rank)}${SUIT_GLYPHS[card.suit]}`;

      if (state.trick.length === 4) {
        state.phase = "trickPause";
        render();
        schedule(finishTrick, 1100);
        return;
      }
      state.turn = (state.turn + 1) % 4;
      render();
      schedule(advancePlaying, 600);
    }

    function finishTrick() {
      const winner = winnerOf(state.trick);
      state.players[winner.player].tricks++;
      const winName = state.players[winner.player].name;
      state.trick = [];
      state.turn = winner.player;
      state.leader = winner.player;
      state.message = `${winName} won the trick`;

      const totalTricks = state.players.reduce((s, p) => s + p.tricks, 0);
      if (totalTricks === 13) {
        scoreHand();
        return;
      }
      state.phase = "playing";
      render();
      schedule(advancePlaying, 700);
    }

    function legalPlays(playerIdx) {
      const hand = state.players[playerIdx].hand;
      if (state.trick.length === 0) {
        // Leading: can't lead spades unless broken or only spades left.
        if (state.spadesBroken) return hand.slice();
        const nonSpades = hand.filter((c) => c.suit !== "S");
        return nonSpades.length > 0 ? nonSpades : hand.slice();
      }
      const ledSuit = state.trick[0].card.suit;
      const followers = hand.filter((c) => c.suit === ledSuit);
      return followers.length > 0 ? followers : hand.slice();
    }

    function winnerOf(trick) {
      let winner = trick[0];
      for (let i = 1; i < trick.length; i++) {
        const c = trick[i].card;
        const w = winner.card;
        if (c.suit === "S" && w.suit !== "S") winner = trick[i];
        else if (c.suit === w.suit && c.rank > w.rank) winner = trick[i];
      }
      return winner;
    }

    function botPlay(playerIdx) {
      const legals = legalPlays(playerIdx);
      const partner = (playerIdx + 2) % 4;
      const lowest = (cards) => cards.slice().sort((a, b) => a.rank - b.rank)[0];

      if (state.trick.length === 0) {
        // Leading: lead lowest non-spade if available, else lowest spade.
        const ns = legals.filter((c) => c.suit !== "S");
        return lowest(ns.length > 0 ? ns : legals);
      }

      const ledSuit = state.trick[0].card.suit;
      const followers = legals.filter((c) => c.suit === ledSuit);
      const winner = winnerOf(state.trick);
      const partnerWinning = winner.player === partner;

      if (followers.length > 0) {
        // Must follow suit.
        if (partnerWinning) return lowest(followers);
        const beats = followers.filter((c) => beatsCard(c, winner.card));
        if (beats.length > 0) return lowest(beats);
        return lowest(followers);
      }

      // Void in lead suit.
      if (partnerWinning) {
        const ns = legals.filter((c) => c.suit !== "S");
        return lowest(ns.length > 0 ? ns : legals);
      }

      const spades = legals.filter((c) => c.suit === "S");
      const winnerIsSpade = winner.card.suit === "S";
      if (spades.length > 0) {
        if (winnerIsSpade) {
          const over = spades.filter((c) => c.rank > winner.card.rank);
          if (over.length > 0) return lowest(over);
        } else {
          return lowest(spades);
        }
      }
      const ns = legals.filter((c) => c.suit !== "S");
      return lowest(ns.length > 0 ? ns : legals);
    }

    function beatsCard(card, current) {
      if (card.suit === "S" && current.suit !== "S") return true;
      if (card.suit === current.suit && card.rank > current.rank) return true;
      return false;
    }

    /* ---------- scoring ---------- */

    function scoreHand() {
      state.phase = "scoring";
      const breakdown = [];
      for (let team = 0; team < 2; team++) {
        const idxs = [0, 1, 2, 3].filter((i) => TEAM_OF[i] === team);
        const ps = idxs.map((i) => state.players[i]);
        let teamPts = 0;
        let teamBags = 0;
        // Score nil bids.
        for (const p of ps) {
          if (p.bid === 0) {
            teamPts += p.tricks === 0 ? 100 : -100;
          }
        }
        // Score the contract for non-nil bidders combined.
        const nonNil = ps.filter((p) => p.bid > 0);
        if (nonNil.length > 0) {
          const totalBid = nonNil.reduce((s, p) => s + p.bid, 0);
          const totalTricks = ps.reduce((s, p) => s + p.tricks, 0);
          if (totalTricks >= totalBid) {
            teamPts += 10 * totalBid;
            const bags = totalTricks - totalBid;
            teamPts += bags;
            teamBags += bags;
          } else {
            teamPts -= 10 * totalBid;
          }
        }
        state.teams[team].score += teamPts;
        state.teams[team].bags += teamBags;
        // 10-bag penalty.
        while (state.teams[team].bags >= 10) {
          state.teams[team].score -= 100;
          state.teams[team].bags -= 10;
        }
        breakdown.push(teamPts);
      }

      const fmt = (n) => (n >= 0 ? "+" : "") + n;
      state.message = `Round ${state.round} — Us ${fmt(breakdown[0])}, Them ${fmt(breakdown[1])}`;

      const usDone = state.teams[0].score >= TARGET_SCORE;
      const themDone = state.teams[1].score >= TARGET_SCORE;
      if (usDone || themDone) {
        const usWin = state.teams[0].score > state.teams[1].score;
        state.phase = "gameover";
        state.message = `Game over — ${usWin ? "You win" : "They win"} ${state.teams[0].score} to ${state.teams[1].score}!`;
        render();
        return;
      }
      render();
      schedule(newRound, 2800);
    }

    /* ---------- rendering ---------- */

    function makeCardEl(card, faceUp) {
      const el = document.createElement("div");
      el.className = "sp-card";
      if (!faceUp) {
        el.classList.add("face-down");
        return el;
      }
      if (isRed(card.suit)) el.classList.add("red");
      const r = rankLabel(card.rank);
      const s = SUIT_GLYPHS[card.suit];
      el.innerHTML =
        `<div class="sp-card-corner"><div class="sp-card-rank">${r}</div>` +
        `<div class="sp-card-suit">${s}</div></div>` +
        `<div class="sp-card-big">${s}</div>`;
      return el;
    }

    function render() {
      // Hands.
      for (let i = 0; i < 4; i++) {
        const seat = SEAT_LETTER[i];
        const handEl = document.getElementById(`spHand${seat}`);
        if (!handEl) continue;
        handEl.innerHTML = "";
        const player = state.players[i];
        const isHuman = player.isHuman;
        const isMyTurn = state.phase === "playing" && state.turn === i;
        const legals = isHuman && isMyTurn ? legalPlays(i) : [];

        player.hand.forEach((card) => {
          const el = makeCardEl(card, isHuman);
          if (isHuman) {
            if (isMyTurn) {
              const legal = legals.some((c) => c.suit === card.suit && c.rank === card.rank);
              if (legal) {
                el.classList.add("playable");
                el.addEventListener("click", () => humanPlay(card));
              } else {
                el.classList.add("illegal");
              }
            }
          }
          handEl.appendChild(el);
        });

        const tricksEl = document.getElementById(`spTricks${seat}`);
        if (tricksEl) {
          if (state.phase === "bidding" && player.bid === null) {
            tricksEl.textContent = state.bidder === i ? "bidding…" : "—";
          } else {
            const bidStr = player.bid === null ? "—" : player.bid === 0 ? "nil" : `bid ${player.bid}`;
            tricksEl.textContent = `${bidStr} · won ${player.tricks}`;
          }
        }

        const seatEl = document.getElementById(`spSeat${seat}`);
        if (seatEl) {
          const active =
            (state.phase === "bidding" && state.bidder === i) ||
            (state.phase === "playing" && state.turn === i);
          seatEl.classList.toggle("sp-active", active);
        }
      }

      // Trick area.
      const trickEl = document.getElementById("spTrick");
      if (trickEl) {
        trickEl.innerHTML = "";
        state.trick.forEach((entry) => {
          const el = makeCardEl(entry.card, true);
          el.classList.add(`sp-trick-card-${SEAT_LOWER[entry.player]}`);
          trickEl.appendChild(el);
        });
      }

      // Scoreboard.
      const setText = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
      };
      setText("spScoreUs", state.teams[0].score);
      setText("spScoreThem", state.teams[1].score);
      setText("spBagsUs", `${state.teams[0].bags} bags`);
      setText("spBagsThem", `${state.teams[1].bags} bags`);
      setText("spRound", `Round ${state.round}`);
      setText("spStatus", state.message || "");

      // Bid buttons (only for human's bidding turn).
      const bidEl = document.getElementById("spBidUI");
      if (bidEl) {
        bidEl.innerHTML = "";
        const showBid = state.phase === "bidding" && state.players[state.bidder].isHuman;
        bidEl.style.display = showBid ? "" : "none";
        if (showBid) {
          const label = document.createElement("div");
          label.className = "sp-bid-label";
          label.textContent = "Bid:";
          bidEl.appendChild(label);
          for (let bid = 0; bid <= 8; bid++) {
            const btn = document.createElement("button");
            btn.className = "sp-bid-btn" + (bid === 0 ? " nil" : "");
            btn.textContent = bid === 0 ? "Nil" : String(bid);
            btn.addEventListener("click", () => placeBid(bid));
            bidEl.appendChild(btn);
          }
        }
      }
    }

    function init() {
      const newBtn = document.getElementById("spNewBtn");
      if (!newBtn) return;
      newBtn.addEventListener("click", newGame);
      newGame();
    }

    return { init };
  })();

  /* ============================================================
     CHECKERS (American 8x8) — you are red, computer is black.
     ============================================================ */
  const Checkers = (() => {
    const D = 8;
    const FOUR = [
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1],
    ];

    const boardEl = () => document.getElementById("checkersBoard");
    const statusEl = () => document.getElementById("checkersStatus");
    const metaEl = () => document.getElementById("checkersMeta");

    const CPU_KEY = "bic.checkers.cpuLevel";
    const FORCED_KEY = "bic.checkers.forcedCapture";
    /** Search depth per level (1 = weakest … 5 = strongest). */
    const CPU_DEPTH = [1, 2, 3, 4, 5];

    function loadCpuLevel() {
      let v = store.get(CPU_KEY, 3);
      if (typeof v !== "number" || v < 1 || v > 5) v = 3;
      return v;
    }
    let cpuLevel = loadCpuLevel();
    let forcedCapture = store.get(FORCED_KEY, true);

    function isDark(r, c) {
      return (r + c) % 2 === 1;
    }
    function inB(r, c) {
      return r >= 0 && r < D && c >= 0 && c < D;
    }

    function copyBoard(b) {
      return b.map((row) => row.map((c) => (c ? { c: c.c, k: c.k } : null)));
    }

    function initBoard() {
      const b = Array.from({ length: D }, () => Array(D).fill(null));
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < D; c++) {
          if (isDark(r, c)) b[r][c] = { c: "b", k: false };
        }
      }
      for (let r = 5; r < D; r++) {
        for (let c = 0; c < D; c++) {
          if (isDark(r, c)) b[r][c] = { c: "r", k: false };
        }
      }
      return b;
    }

    function dirsFor(piece) {
      if (piece.k) return FOUR;
      return piece.c === "r"
        ? [
            [-1, -1],
            [-1, 1],
          ]
        : [
            [1, -1],
            [1, 1],
          ];
    }

    function jumpPathsFrom(r, c, b, color) {
      const p = b[r][c];
      if (!p || p.c !== color) return [];
      const out = [];
      for (const [dr, dc] of dirsFor(p)) {
        const er = r + dr;
        const ec = c + dc;
        const lr = r + 2 * dr;
        const lc = c + 2 * dc;
        if (!inB(er, ec) || !inB(lr, lc)) continue;
        const mid = b[er][ec];
        if (!mid || mid.c === color) continue;
        if (b[lr][lc]) continue;
        if (!isDark(lr, lc)) continue;

        const b2 = copyBoard(b);
        b2[er][ec] = null;
        b2[r][c] = null;
        const promote = (color === "r" && lr === 0) || (color === "b" && lr === 7);
        b2[lr][lc] = { c: color, k: p.k || promote };

        const seg = { over: { r: er, c: ec }, land: { r: lr, c: lc } };
        if (promote) {
          out.push({
            from: { r, c },
            to: { r: lr, c: lc },
            segs: [seg],
            n: 1,
          });
          continue;
        }

        const cont = jumpPathsFrom(lr, lc, b2, color);
        if (cont.length === 0) {
          out.push({ from: { r, c }, to: { r: lr, c: lc }, segs: [seg], n: 1 });
        } else {
          for (const m of cont) {
            out.push({
              from: { r, c },
              to: m.to,
              segs: [seg, ...m.segs],
              n: 1 + m.n,
            });
          }
        }
      }
      return out;
    }

    function allJumpsRaw(b, color) {
      const acc = [];
      for (let r = 0; r < D; r++) {
        for (let c = 0; c < D; c++) {
          if (!b[r][c] || b[r][c].c !== color) continue;
          acc.push(...jumpPathsFrom(r, c, b, color));
        }
      }
      return acc;
    }

    function simpleMoves(b, color) {
      const out = [];
      for (let r = 0; r < D; r++) {
        for (let c = 0; c < D; c++) {
          const p = b[r][c];
          if (!p || p.c !== color) continue;
          for (const [dr, dc] of dirsFor(p)) {
            const nr = r + dr;
            const nc = c + dc;
            if (!inB(nr, nc) || b[nr][nc] || !isDark(nr, nc)) continue;
            out.push({ from: { r, c }, to: { r: nr, c: nc }, segs: [], n: 0 });
          }
        }
      }
      return out;
    }

    function getLegalMoves(b, color) {
      const raw = allJumpsRaw(b, color);
      if (forcedCapture) {
        if (raw.length === 0) return simpleMoves(b, color);
        const maxN = raw.reduce((a, m) => Math.max(a, m.n), 0);
        return raw.filter((m) => m.n === maxN);
      }
      const sim = simpleMoves(b, color);
      if (raw.length === 0) return sim;
      return sim.concat(raw);
    }

    function applyMove(b, m) {
      if (!m.segs.length) {
        const p0 = b[m.from.r][m.from.c];
        if (!p0) return;
        b[m.from.r][m.from.c] = null;
        const k =
          p0.k || (p0.c === "r" && m.to.r === 0) || (p0.c === "b" && m.to.r === 7);
        b[m.to.r][m.to.c] = { c: p0.c, k };
        return;
      }
      for (const s of m.segs) b[s.over.r][s.over.c] = null;
      const p0 = b[m.from.r][m.from.c];
      b[m.from.r][m.from.c] = null;
      const last = m.segs[m.segs.length - 1].land;
      const k = p0.k || (p0.c === "r" && last.r === 0) || (p0.c === "b" && last.r === 7);
      b[last.r][last.c] = { c: p0.c, k };
    }

    function countPieces(b) {
      let r = 0;
      let bl = 0;
      for (let i = 0; i < D; i++) {
        for (let j = 0; j < D; j++) {
          const p = b[i][j];
          if (!p) continue;
          if (p.c === "r") r++;
          else bl++;
        }
      }
      return { r, b: bl };
    }

    function evaluate(b) {
      let s = 0;
      for (let i = 0; i < D; i++) {
        for (let j = 0; j < D; j++) {
          const p = b[i][j];
          if (!p) continue;
          const w = p.k ? 3.1 : 1;
          s += p.c === "r" ? w : -w;
        }
      }
      return s;
    }

    function search(b, toMove, depth, a, bta) {
      const moves = getLegalMoves(b, toMove);
      if (moves.length === 0) {
        return toMove === "r" ? -10000 : 10000;
      }
      if (depth === 0) return evaluate(b);

      if (toMove === "r") {
        let v = -1e9;
        for (const m of moves) {
          const nb = copyBoard(b);
          applyMove(nb, m);
          const s = search(nb, "b", depth - 1, a, bta);
          v = Math.max(v, s);
          a = Math.max(a, v);
          if (a >= bta) break;
        }
        return v;
      } else {
        let v = 1e9;
        for (const m of moves) {
          const nb = copyBoard(b);
          applyMove(nb, m);
          const s = search(nb, "r", depth - 1, a, bta);
          v = Math.min(v, s);
          bta = Math.min(bta, v);
          if (bta <= a) break;
        }
        return v;
      }
    }

    function pickAiMove(b) {
      const moves = getLegalMoves(b, "b");
      if (moves.length === 0) return null;
      if (moves.length === 1) return moves[0];
      const searchDepth = CPU_DEPTH[cpuLevel - 1] ?? 3;
      let best = moves[0];
      let bestV = 1e9;
      for (const m of moves) {
        const nb = copyBoard(b);
        applyMove(nb, m);
        const s = search(nb, "r", searchDepth - 1, -1e9, 1e9);
        if (s < bestV) {
          bestV = s;
          best = m;
        }
      }
      return best;
    }

    function findUserMove(legal, from, to) {
      return (
        legal.find(
          (m) =>
            m.from.r === from.r &&
            m.from.c === from.c &&
            m.to.r === to.r &&
            m.to.c === to.c,
        ) || null
      );
    }

    let board = initBoard();
    let turn = "r";
    let gameOver = false;
    let selected = null;
    let lastMove = null;
    let thinking = false;
    let netMode = false;
    let netMyColor = "r";

    function serialCheckersBoard(b) {
      return b.map((row) => row.map((c) => (c ? { c: c.c, k: !!c.k } : null)));
    }
    function deserialCheckersBoard(s) {
      return s.map((row) => row.map((c) => (c ? { c: c.c, k: !!c.k } : null)));
    }
    function sendCheckersNet() {
      if (!netMode || typeof window.bicSendRoomMove !== "function") return;
      try {
        window.bicSendRoomMove("checkers", {
          board: serialCheckersBoard(board),
          turn,
          lastMove: lastMove
            ? { from: { ...lastMove.from }, to: { ...lastMove.to } }
            : null,
        });
      } catch { /* */ }
    }

    function setStatus(msg, kind) {
      const el = statusEl();
      if (!el) return;
      el.textContent = msg;
      el.className = "checkers-status" + (kind ? " checkers-status--" + kind : "");
    }

    function updateMeta() {
      const m = metaEl();
      if (!m) return;
      const n = countPieces(board);
      if (netMode) {
        m.textContent = `You (${netMyColor === "r" ? "red" : "black"}) · R ${n.r} / B ${
          n.b
        } · ${turn === netMyColor ? "Your move" : "Opponent"}`;
        return;
      }
      m.textContent = `You ${n.r} · computer ${n.b} · CPU ${cpuLevel} · ${
        turn === "r" ? "Your move" : "Computer"
      }`;
    }

    function updateForcedNote() {
      const note = document.getElementById("checkersForcedNote");
      if (!note) return;
      if (forcedCapture) {
        note.innerHTML =
          "With <strong>forced capture</strong> on, jumps are required and you must take the most captures in one turn when jumping.";
      } else {
        note.textContent =
          "Forced capture is off — you may move without jumping even when a capture is available.";
      }
    }

    function gameEnded(winnerText) {
      gameOver = true;
      setStatus(winnerText, "ok");
      updateMeta();
      if (netMode) sendCheckersNet();
    }

    function checkEndAfterMove(justMoved) {
      const nxt = justMoved === "r" ? "b" : "r";
      if (getLegalMoves(board, nxt).length === 0) {
        if (netMode) {
          if (nxt === netMyColor) {
            gameEnded("You have no legal moves. Opponent wins.");
          } else {
            gameEnded("Opponent has no legal moves. You win!");
          }
        } else {
          gameEnded(nxt === "r" ? "You have no legal moves. Computer wins." : "Computer cannot move. You win!");
        }
        return true;
      }
      const { r, b: bct } = countPieces(board);
      if (r === 0) {
        if (netMode) {
          gameEnded(netMyColor === "r" ? "You have no pieces left. Opponent wins." : "Opponent (red) has no pieces. You win!");
        } else {
          gameEnded("You have no pieces left. Computer wins.");
        }
        return true;
      }
      if (bct === 0) {
        if (netMode) {
          gameEnded(netMyColor === "b" ? "You have no pieces left. Opponent wins." : "Opponent (black) has no pieces. You win!");
        } else {
          gameEnded("All computer pieces are gone. You win!");
        }
        return true;
      }
      return false;
    }

    function render() {
      const el = boardEl();
      if (!el) return;
      el.innerHTML = "";
      const myTurn = netMode ? turn === netMyColor : turn === "r";
      const legalForHints =
        myTurn && selected && !thinking && !gameOver ? getLegalMoves(board, turn) : null;
      for (let r = 0; r < D; r++) {
        for (let c = 0; c < D; c++) {
          const sq = document.createElement("div");
          const play = isDark(r, c);
          sq.className = play
            ? `checkers-sq checkers-sq--dark checkers-sq--play`
            : "checkers-sq checkers-sq--light";
          sq.dataset.r = String(r);
          sq.dataset.c = String(c);

          const p = board[r][c];
          if (p) {
            const d = document.createElement("div");
            d.className = `checkers-piece checkers-piece--${p.c}` + (p.k ? " checkers-piece--king" : "");
            d.setAttribute("aria-hidden", "true");
            sq.appendChild(d);
          }

          if (play && myTurn && !thinking && !gameOver) {
            if (lastMove) {
              const sqn = (x, y) => r === x && c === y;
              if (sqn(lastMove.from.r, lastMove.from.c) || sqn(lastMove.to.r, lastMove.to.c)) {
                sq.classList.add("checkers-sq--last");
              }
            }
            if (selected && selected.r === r && selected.c === c) sq.classList.add("checkers-sq--sel");
            if (legalForHints) {
              for (const m of legalForHints) {
                if (m.from.r === selected.r && m.from.c === selected.c) {
                  if (m.to.r === r && m.to.c === c) sq.classList.add("checkers-sq--hint");
                }
              }
            }
            sq.addEventListener("click", () => onClick(r, c));
          }

          el.appendChild(sq);
        }
      }
    }

    function onClick(r, c) {
      const myTurnG = netMode ? turn === netMyColor : turn === "r";
      if (!myTurnG || gameOver || thinking) return;
      const legal = getLegalMoves(board, turn);
      if (legal.length === 0) return;

      const cell = board[r][c];
      if (cell && cell.c === turn) {
        const has = legal.some((m) => m.from.r === r && m.from.c === c);
        if (has) {
          selected = { r, c };
          render();
        }
        return;
      }

      if (!selected) return;
      const m = findUserMove(legal, selected, { r, c });
      if (!m) {
        if (cell && cell.c === turn) {
          const has = legal.some((mo) => mo.from.r === r && mo.from.c === c);
          if (has) selected = { r, c };
        }
        render();
        return;
      }

      const movedColor = turn;
      applyMove(board, m);
      lastMove = { from: { ...m.from }, to: { ...m.to } };
      turn = turn === "r" ? "b" : "r";
      selected = null;
      updateMeta();
      if (checkEndAfterMove(movedColor)) {
        render();
        return;
      }
      if (netMode) {
        sendCheckersNet();
        setStatus(turn === netMyColor ? "Your move." : "Opponent’s turn — waiting…", "");
        updateMeta();
        render();
        return;
      }
      setStatus("Computer is thinking…", "wait");
      thinking = true;
      render();
      window.setTimeout(() => {
        thinking = false;
        const am = pickAiMove(board);
        if (!am) {
          gameOver = true;
          setStatus("Computer has no move. You win!", "ok");
          render();
          return;
        }
        applyMove(board, am);
        lastMove = { from: { ...am.from }, to: { ...am.to } };
        turn = "r";
        if (checkEndAfterMove("b")) {
          render();
          return;
        }
        setStatus("Your move.");
        updateMeta();
        render();
      }, 200);
    }

    function newGame() {
      if (netMode) return;
      board = initBoard();
      turn = "r";
      gameOver = false;
      selected = null;
      lastMove = null;
      thinking = false;
      setStatus("Your move.");
      updateMeta();
      render();
    }

    function startCheckersOnline(isHost) {
      netMode = true;
      netMyColor = isHost ? "r" : "b";
      const raw = sessionStorage.getItem("bic_checkers_state");
      sessionStorage.removeItem("bic_checkers_state");
      if (raw) {
        try {
          const o = JSON.parse(raw);
          if (o.board) board = deserialCheckersBoard(o.board);
          if (o.turn) turn = o.turn;
          lastMove = o.lastMove || null;
        } catch { /* */ }
      } else {
        board = initBoard();
        turn = "r";
        lastMove = null;
      }
      if (window.bicCheckersNetOptions && typeof window.bicCheckersNetOptions.forcedCapture === "boolean") {
        forcedCapture = window.bicCheckersNetOptions.forcedCapture;
        const forcedEl = document.getElementById("checkersForced");
        if (forcedEl) forcedEl.checked = forcedCapture;
        updateForcedNote();
      }
      gameOver = false;
      selected = null;
      thinking = false;
      setStatus(netMyColor === "r" ? "Your move (red, online)." : "Opponent (red) moves first — wait.", "");
      const set = document.getElementById("checkersSettings");
      const leave = document.getElementById("checkersLeaveNet");
      if (set) set.style.display = "none";
      if (leave) leave.style.display = "inline-block";
      const cpuW = document.getElementById("checkersCpu");
      if (cpuW && cpuW.closest(".checkers-set")) {
        cpuW.closest(".checkers-set").style.display = "none";
      }
      updateMeta();
      render();
    }

    function clearCheckersNet() {
      netMode = false;
      netMyColor = "r";
      const set = document.getElementById("checkersSettings");
      const leave = document.getElementById("checkersLeaveNet");
      if (set) set.style.display = "";
      if (leave) leave.style.display = "none";
      const c = document.getElementById("checkersCpu");
      if (c && c.closest(".checkers-set")) c.closest(".checkers-set").style.display = "";
      newGame();
    }

    function applyCheckersFromNet(payload) {
      if (!payload || !payload.board) return;
      board = deserialCheckersBoard(payload.board);
      turn = payload.turn === "b" || payload.turn === "r" ? payload.turn : "r";
      lastMove = payload.lastMove || null;
      gameOver = false;
      selected = null;
      thinking = false;
      setStatus(turn === netMyColor ? "Your move." : "Opponent’s turn — waiting…", "");
      updateMeta();
      render();
    }

    function init() {
      const newBtn = document.getElementById("checkersNewBtn");
      if (newBtn) {
        newBtn.addEventListener("click", newGame);
      }
      const cpuEl = document.getElementById("checkersCpu");
      const forcedEl = document.getElementById("checkersForced");
      cpuLevel = loadCpuLevel();
      forcedCapture = store.get(FORCED_KEY, true);
      if (cpuEl) {
        cpuEl.value = String(cpuLevel);
        cpuEl.addEventListener("change", () => {
          const v = parseInt(cpuEl.value, 10);
          cpuLevel = v >= 1 && v <= 5 ? v : 3;
          store.set(CPU_KEY, cpuLevel);
          updateMeta();
        });
      }
      if (forcedEl) {
        forcedEl.checked = forcedCapture;
        forcedEl.addEventListener("change", () => {
          forcedCapture = forcedEl.checked;
          store.set(FORCED_KEY, forcedCapture);
          updateForcedNote();
          render();
        });
      }
      const leaveNet = document.getElementById("checkersLeaveNet");
      if (leaveNet) {
        leaveNet.addEventListener("click", () => {
          if (netMode) {
            setStatus("Left online game.", "ok");
            clearCheckersNet();
          }
        });
      }
      window.bicStartCheckersOnline = (isHost) => {
        startCheckersOnline(!!isHost);
      };
      window.bicApplyCheckersNet = (payload) => {
        if (netMode) applyCheckersFromNet(payload);
      };
      window.bicOnPeerLeftCheckers = () => {
        if (netMode) {
          setStatus("Opponent left the room. Leaving online mode.", "ok");
          clearCheckersNet();
        }
      };
      updateForcedNote();
      newGame();
    }

    return { init };
  })();

  /* ============================================================
     TIC TAC TOE — human X vs perfect O (minimax)
     ============================================================ */
  const TicTacToe = (() => {
    const LINES = [
      [0, 1, 2],
      [3, 4, 5],
      [6, 7, 8],
      [0, 3, 6],
      [1, 4, 7],
      [2, 5, 8],
      [0, 4, 8],
      [2, 4, 6],
    ];
    const grid = () => document.getElementById("tttGrid");
    const st = () => document.getElementById("tttStatus");

    let board = Array(9).fill(null);
    let over = false;
    let turn = "x";

    function lineWin() {
      for (const [a, b, c] of LINES) {
        if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
      }
      return null;
    }
    function isFull() {
      return board.every(Boolean);
    }
    function scoreTerminal() {
      const w = lineWin();
      if (w) return w === "o" ? 1 : -1;
      if (isFull()) return 0;
      return null;
    }
    function minimax(isMax) {
      const t = scoreTerminal();
      if (t !== null) return t;
      if (isMax) {
        let v = -2;
        for (let i = 0; i < 9; i++) {
          if (board[i]) continue;
          board[i] = "o";
          v = Math.max(v, minimax(false));
          board[i] = null;
        }
        return v;
      } else {
        let v = 2;
        for (let i = 0; i < 9; i++) {
          if (board[i]) continue;
          board[i] = "x";
          v = Math.min(v, minimax(true));
          board[i] = null;
        }
        return v;
      }
    }
    function bestO() {
      let bi = -1;
      let bs = -2;
      for (let i = 0; i < 9; i++) {
        if (board[i]) continue;
        board[i] = "o";
        const s = minimax(false);
        board[i] = null;
        if (s > bs) {
          bs = s;
          bi = i;
        }
      }
      return bi;
    }
    function setStatus(msg, cls) {
      const el = st();
      if (!el) return;
      el.textContent = msg;
      el.className = "ttt-status" + (cls ? " " + cls : "");
    }
    function render() {
      const g = grid();
      if (!g) return;
      g.innerHTML = "";
      for (let i = 0; i < 9; i++) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "ttt-cell";
        btn.setAttribute("role", "gridcell");
        const v = board[i];
        if (v) {
          btn.textContent = v === "x" ? "X" : "O";
          btn.classList.add(v === "x" ? "ttt--x" : "ttt--o");
        } else {
          btn.textContent = "\u00a0";
        }
        const disabled = over || v != null || turn === "o";
        btn.disabled = Boolean(disabled);
        btn.addEventListener("click", () => onCell(i));
        g.appendChild(btn);
      }
    }
    function onCell(i) {
      if (over || board[i] != null || turn !== "x") return;
      board[i] = "x";
      const w = lineWin();
      if (w) {
        over = true;
        setStatus("You win! (X)", "ttt-ok");
        render();
        return;
      }
      if (isFull()) {
        over = true;
        setStatus("Draw.", "");
        render();
        return;
      }
      turn = "o";
      setStatus("Computer is thinking…", "");
      render();
      window.setTimeout(() => {
        const j = bestO();
        if (j >= 0) board[j] = "o";
        turn = "x";
        const w2 = lineWin();
        if (w2 === "o") {
          over = true;
          setStatus("Computer wins (O).", "ttt-bad");
        } else if (isFull()) {
          over = true;
          setStatus("Draw.", "");
        } else {
          setStatus("Your turn (X).", "");
        }
        render();
      }, 180);
    }
    function newGame() {
      board = Array(9).fill(null);
      over = false;
      turn = "x";
      setStatus("Your turn (X).", "");
      render();
    }
    function init() {
      const b = document.getElementById("tttNew");
      if (!b) return;
      b.addEventListener("click", newGame);
      newGame();
    }
    return { init };
  })();

  /* ============================================================
     CRACKER BARREL — triangular peg solitaire
     ============================================================ */
  const CrackerBarrel = (() => {
    function i2rc(i) {
      let acc = 0;
      for (let r = 0; r < 5; r++) {
        const w = r + 1;
        if (i < acc + w) return { r, c: i - acc };
        acc += w;
      }
      return { r: 0, c: 0 };
    }
    function rc2i(r, c) {
      let i = 0;
      for (let rr = 0; rr < r; rr++) i += rr + 1;
      return i + c;
    }
    function neighborsRC(r, c) {
      const out = [];
      const cand = [
        [r - 1, c - 1],
        [r - 1, c],
        [r + 1, c],
        [r + 1, c + 1],
        [r, c - 1],
        [r, c + 1],
      ];
      for (const [a, b] of cand) {
        if (a >= 0 && a < 5 && b >= 0 && b <= a) out.push([a, b]);
      }
      return out;
    }
    function buildPegMoves() {
      const moves = [];
      const seen = new Set();
      for (let from = 0; from < 15; from++) {
        const A = i2rc(from);
        for (const [r1, c1] of neighborsRC(A.r, A.c)) {
          const over = rc2i(r1, c1);
          const r2 = 2 * r1 - A.r;
          const c2 = 2 * c1 - A.c;
          if (r2 < 0 || r2 > 4 || c2 < 0 || c2 > r2) continue;
          const to = rc2i(r2, c2);
          const k = `${from},${over},${to}`;
          if (seen.has(k)) continue;
          seen.add(k);
          moves.push({ from, over, to });
        }
      }
      return moves;
    }
    const PEG_MOVES = buildPegMoves();

    const pegB = () => document.getElementById("pegBoard");
    const pegS = () => document.getElementById("pegStatus");
    const pegC = () => document.getElementById("pegCount");

    let board = [];
    let selected = null;
    let over = false;

    function countPegs() {
      return board.reduce((a, p) => a + p, 0);
    }
    function legalMoves() {
      const o = [];
      for (const m of PEG_MOVES) {
        if (board[m.from] && board[m.over] && !board[m.to]) o.push(m);
      }
      return o;
    }
    function anyJumpFrom(i) {
      return legalMoves().filter((m) => m.from === i);
    }
    function hasLegal() {
      return legalMoves().length > 0;
    }
    function setStatus(msg, cls) {
      const el = pegS();
      if (!el) return;
      el.textContent = msg;
      el.className = "peg-status" + (cls ? " " + cls : "");
    }
    function updateCount() {
      const el = pegC();
      if (!el) return;
      const n = countPegs();
      el.textContent = n === 1 ? "1 peg left" : `${n} pegs on the board`;
    }
    function endMessage() {
      const n = countPegs();
      over = true;
      if (n === 1) {
        if (board[0] === 1) {
          setStatus("Perfect! One peg, and it is in the top hole. ", "peg-ok");
        } else {
          setStatus(
            "You finished with one peg. Try to end in the top hole for a perfect game.",
            "peg-ok",
          );
        }
        return;
      }
      if (!hasLegal()) {
        setStatus(
          `No more jumps. ${n} pegs left. ` + (n <= 3 ? "Close — play again to improve." : "New game?"),
          "",
        );
      }
    }
    function applyPeg(m) {
      board[m.from] = 0;
      board[m.over] = 0;
      board[m.to] = 1;
    }
    function newGame() {
      board = Array(15).fill(1);
      board[0] = 0;
      selected = null;
      over = false;
      setStatus("Select a peg, then a highlighted hole to jump to.", "");
      updateCount();
      render();
    }
    function render() {
      const el = pegB();
      if (!el) return;
      el.innerHTML = "";
      const leg = hasLegal() ? legalMoves() : [];
      const canDest = new Set();
      if (selected != null) {
        for (const m of leg) {
          if (m.from === selected) canDest.add(m.to);
        }
      }
      for (let r = 0; r < 5; r++) {
        const row = document.createElement("div");
        row.className = "peg-row";
        for (let c = 0; c <= r; c++) {
          const idx = rc2i(r, c);
          const b = document.createElement("button");
          b.type = "button";
          b.className = "peg-hole";
          b.dataset.i = String(idx);
          if (board[idx]) {
            b.classList.add("peg-hole--peg");
            b.setAttribute("aria-label", "Peg at hole " + (idx + 1));
            if (selected === idx) b.classList.add("peg-hole--sel");
            b.addEventListener("click", () => onPegClick(idx));
          } else {
            b.classList.add("peg-hole--empty");
            b.setAttribute("aria-label", "Empty hole " + (idx + 1));
            if (canDest.has(idx) && !over) {
              b.classList.add("peg-hole--can");
              b.addEventListener("click", () => onPegClick(idx));
            }
          }
          row.appendChild(b);
        }
        el.appendChild(row);
      }
    }
    function onPegClick(i) {
      if (over) return;
      if (board[i]) {
        if (anyJumpFrom(i).length === 0) {
          setStatus("That peg cannot jump. Choose another.", "");
        } else {
          setStatus("Jump into a highlighted hole.", "");
        }
        selected = i;
        render();
        return;
      }
      if (selected == null) return;
      const m = legalMoves().find(
        (mv) => mv.from === selected && mv.to === i,
      );
      if (!m) {
        setStatus("You cannot jump there. Pick a highlighted hole, or another peg.", "");
        return;
      }
      applyPeg(m);
      selected = null;
      const n = countPegs();
      updateCount();
      if (n === 1) {
        endMessage();
        updateCount();
        render();
        return;
      }
      if (!hasLegal()) {
        endMessage();
      } else {
        setStatus("Good jump. Next move.", "");
      }
      render();
    }
    function init() {
      const n = document.getElementById("pegNew");
      if (!n) return;
      n.addEventListener("click", newGame);
      newGame();
    }
    return { init };
  })();

  /* ============================================================
     INIT
     ============================================================ */
  // Wait for DOM ready in case scripts are not at end of body.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      Typing.init();
      Chess.init();
      Checkers.init();
      TicTacToe.init();
      CrackerBarrel.init();
      Curveball.init();
      Solitaire.init();
      Spider.init();
      Spades.init();
    });
  } else {
    Typing.init();
    Chess.init();
    Checkers.init();
    TicTacToe.init();
    CrackerBarrel.init();
    Curveball.init();
    Solitaire.init();
    Spider.init();
    Spades.init();
  }
})();
