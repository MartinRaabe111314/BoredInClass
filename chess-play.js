/* ============================================================
   Chess — full game vs engine (user White, Black CPU). Levels 1–5.
   Castling, en passant, promotion to queen, 50-move rule, mate/stalemate.
   ============================================================ */
(() => {
  "use strict";

  const $ = (sel) => document.querySelector(sel);
  const store = {
    get(k, f) {
      try {
        const r = localStorage.getItem(k);
        return r == null ? f : JSON.parse(r);
      } catch {
        return f;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem(k, JSON.stringify(v));
      } catch { /* */ }
    },
  };

  const CP_DIFF_KEY = "bic.chessplay.diff";
  function cpuLevel() {
    let d = +store.get(CP_DIFF_KEY, 3);
    if (Number.isNaN(d) || d < 1) d = 1;
    if (d > 5) d = 5;
    return d;
  }
  const DEPTH_PLIES = [0, 2, 2, 3, 3, 4];

  const GLY = {
    K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘", P: "♙",
    k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟",
  };

  const MATE = 1_000_000;
  const MVAL = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };

  function pieceVal(ch) {
    if (!ch) return 0;
    return MVAL[ch.toLowerCase()] || 0;
  }
  function isW(ch) { return ch === ch.toUpperCase(); }
  function sqRC(sq) {
    return { r: 8 - +sq[1], c: sq.charCodeAt(0) - 97 };
  }
  function rcSq(r, c) {
    return String.fromCharCode(97 + c) + (8 - r);
  }

  const ROOK_DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const BISH_DIRS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  const NIGHT = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];

  function copyBoard(b) {
    return b.map((row) => row.slice());
  }

  function parseFen(fen) {
    const parts = fen.split(/\s+/);
    const rows = parts[0].split("/");
    const b = [];
    for (let r = 0; r < 8; r++) {
      const row = [];
      for (const ch of rows[r]) {
        if (/\d/.test(ch)) {
          for (let i = 0; i < +ch; i++) row.push(null);
        } else row.push(ch);
      }
      b.push(row);
    }
    const wtm = (parts[1] || "w") === "w";
    const cast = parts[2] || "-";
    let ca = 0;
    if (cast !== "-") {
      for (const ch of cast) {
        if (ch === "K") ca |= 1;
        if (ch === "Q") ca |= 2;
        if (ch === "k") ca |= 4;
        if (ch === "q") ca |= 8;
      }
    }
    const epS = parts[3] && parts[3] !== "-" ? parts[3] : null;
    const ep = epS ? sqRC(epS) : null;
    const half = +(parts[4] || 0) || 0;
    return { b, wtm, ca, ep, half };
  }

  function stateToFen(st) {
    const rStr = [];
    for (let r = 0; r < 8; r++) {
      let s = "";
      let empty = 0;
      for (let c = 0; c < 8; c++) {
        const p = st.b[r][c];
        if (!p) {
          empty++;
        } else {
          if (empty) {
            s += String(empty);
            empty = 0;
          }
          s += p;
        }
      }
      if (empty) s += String(empty);
      rStr.push(s);
    }
    const p1 = rStr.join("/");
    const tm = st.wtm ? "w" : "b";
    let cst = "-";
    if (st.ca) {
      const p = [];
      if (st.ca & 1) p.push("K");
      if (st.ca & 2) p.push("Q");
      if (st.ca & 4) p.push("k");
      if (st.ca & 8) p.push("q");
      cst = p.length ? p.join("") : "-";
    }
    let epa = "-";
    if (st.ep) {
      const file = String.fromCharCode(97 + st.ep.c);
      const rank = 8 - st.ep.r;
      epa = file + rank;
    }
    return `${p1} ${tm} ${cst} ${epa} ${st.half} 1`;
  }

  function findKing(b, w) {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = b[r][c];
        if (p && (p === "K" || p === "k") && isW(p) === w) return { r, c };
      }
    }
    return { r: -1, c: -1 };
  }

  function squareAttacked(st, r, c, byWhite) {
    const b = st.b;
    const ew = (ch) => ch && isW(ch) === byWhite;
    for (let pr = 0; pr < 8; pr++) {
      for (let pc = 0; pc < 8; pc++) {
        const p = b[pr][pc];
        if (!ew(p)) continue;
        const t = p.toLowerCase();
        if (t === "n") {
          for (const [dr, dc] of NIGHT) {
            if (pr + dr === r && pc + dc === c) return true;
          }
          continue;
        }
        if (t === "k") {
          if (Math.abs(pr - r) <= 1 && Math.abs(pc - c) <= 1) return true;
          continue;
        }
        if (t === "p") {
          const di = byWhite ? -1 : 1;
          if (r === pr + di && (c === pc + 1 || c === pc - 1)) return true;
          continue;
        }
        if (t === "r" || t === "q") {
          for (const [dr, dc] of ROOK_DIRS) {
            for (let i = 1; i < 8; i++) {
              const rr = pr + dr * i;
              const cc = pc + dc * i;
              if (rr < 0 || rr > 7 || cc < 0 || cc > 7) break;
              if (rr === r && cc === c) return true;
              if (b[rr][cc]) break;
            }
          }
        }
        if (t === "b" || t === "q") {
          for (const [dr, dc] of BISH_DIRS) {
            for (let i = 1; i < 8; i++) {
              const rr = pr + dr * i;
              const cc = pc + dc * i;
              if (rr < 0 || rr > 7 || cc < 0 || cc > 7) break;
              if (rr === r && cc === c) return true;
              if (b[rr][cc]) break;
            }
          }
        }
      }
    }
    return false;
  }

  function inCheck(st, wKing) {
    const k = findKing(st.b, wKing);
    if (k.r < 0) return false;
    return squareAttacked(st, k.r, k.c, !wKing);
  }

  function genPseudo(st) {
    const out = [];
    const b = st.b;
    const w = st.wtm;
    const ally = (ch) => ch && isW(ch) === w;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p0 = b[r][c];
        if (!ally(p0)) continue;
        const t = p0.toLowerCase();
        if (t === "p") {
          const d = w ? -1 : 1;
          const stR = w ? 6 : 1;
          const proR = w ? 0 : 7;
          const nr = r + d;
          if (nr === proR) {
            if (nr >= 0 && nr < 8 && !b[nr][c]) {
              out.push({ r, c, toR: nr, toC: c, promo: "q" });
            }
            for (const dc of [-1, 1]) {
              const nc = c + dc;
              if (nc < 0 || nc > 7) continue;
              if (b[nr][nc] && isW(b[nr][nc]) !== w) {
                out.push({ r, c, toR: nr, toC: nc, cap: 1, promo: "q" });
              }
            }
            continue;
          }
          if (nr >= 0 && b[nr][c] == null) {
            out.push({ r, c, toR: nr, toC: c });
            if (r === stR) {
              const dr2 = r + 2 * d;
              if (dr2 >= 0 && dr2 < 8 && b[dr2][c] == null) {
                out.push({ r, c, toR: dr2, toC: c, double: 1 });
              }
            }
          }
          for (const dc of [-1, 1]) {
            const nc = c + dc;
            if (nc < 0 || nc > 7) continue;
            if (nr >= 0 && nr < 8 && b[nr][nc] && isW(b[nr][nc]) !== w) {
              out.push({ r, c, toR: nr, toC: nc, cap: 1 });
            }
            if (nr >= 0 && nr < 8 && !b[nr][nc] && st.ep && st.ep.r === nr && st.ep.c === nc) {
              out.push({ r, c, toR: nr, toC: nc, cap: 1, ep: 1 });
            }
          }
        } else if (t === "n") {
          for (const [dr, dc] of NIGHT) {
            const toR = r + dr;
            const toC = c + dc;
            if (toR < 0 || toR > 7 || toC < 0 || toC > 7) continue;
            const t2 = b[toR][toC];
            if (t2 == null || isW(t2) !== w) {
              out.push({ r, c, toR, toC, cap: t2 ? 1 : 0 });
            }
          }
        } else if (t === "k") {
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              if (!dr && !dc) continue;
              const toR = r + dr;
              const toC = c + dc;
              if (toR < 0 || toR > 7 || toC < 0 || toC > 7) continue;
              const t2 = b[toR][toC];
              if (t2 == null || isW(t2) !== w) {
                out.push({ r, c, toR, toC, cap: t2 ? 1 : 0 });
              }
            }
          }
          if (p0 === "K" && r === 7 && c === 4) {
            if ((st.ca & 1) && b[7][5] == null && b[7][6] == null && b[7][7] === "R") {
              const s0 = { b: st.b, wtm: st.wtm, ca: st.ca, ep: st.ep, half: st.half };
              if (!inCheck(s0, true) && !squareAttacked(s0, 7, 5, false) && !squareAttacked(s0, 7, 6, false)) {
                out.push({ r, c, toR: 7, toC: 6, cast: 1 });
              }
            }
            if ((st.ca & 2) && b[7][1] == null && b[7][2] == null && b[7][3] == null && b[7][0] === "R") {
              const s0 = { b: st.b, wtm: st.wtm, ca: st.ca, ep: st.ep, half: st.half };
              if (!inCheck(s0, true) && !squareAttacked(s0, 7, 3, false) && !squareAttacked(s0, 7, 2, false)) {
                out.push({ r, c, toR: 7, toC: 2, cast: 1 });
              }
            }
          }
          if (p0 === "k" && r === 0 && c === 4) {
            if ((st.ca & 4) && b[0][5] == null && b[0][6] == null && b[0][7] === "r") {
              const s0 = { b: st.b, wtm: st.wtm, ca: st.ca, ep: st.ep, half: st.half };
              if (!inCheck(s0, false) && !squareAttacked(s0, 0, 5, true) && !squareAttacked(s0, 0, 6, true)) {
                out.push({ r, c, toR: 0, toC: 6, cast: 1 });
              }
            }
            if ((st.ca & 8) && b[0][1] == null && b[0][2] == null && b[0][3] == null && b[0][0] === "r") {
              const s0 = { b: st.b, wtm: st.wtm, ca: st.ca, ep: st.ep, half: st.half };
              if (!inCheck(s0, false) && !squareAttacked(s0, 0, 3, true) && !squareAttacked(s0, 0, 2, true)) {
                out.push({ r, c, toR: 0, toC: 2, cast: 1 });
              }
            }
          }
        } else {
          const dirs = t === "r" ? ROOK_DIRS : t === "b" ? BISH_DIRS : ROOK_DIRS.concat(BISH_DIRS);
          for (const [dr, dc] of dirs) {
            for (let i = 1; i < 8; i++) {
              const toR = r + dr * i;
              const toC = c + dc * i;
              if (toR < 0 || toR > 7 || toC < 0 || toC > 7) break;
              const t2 = b[toR][toC];
              if (t2 == null) {
                out.push({ r, c, toR, toC, cap: 0 });
              } else {
                if (isW(t2) !== w) {
                  out.push({ r, c, toR, toC, cap: 1 });
                }
                break;
              }
            }
          }
        }
      }
    }
    return out;
  }

  function applyMoveFixed(st, m) {
    const b = copyBoard(st.b);
    const w = st.wtm;
    let ca = st.ca;
    const piece = b[m.r][m.c];
    if (!piece) return null;
    const target = b[m.toR][m.toC];

    if (m.cast) {
      const rr = m.toR;
      if (m.toC === 6) {
        b[rr][4] = null;
        b[rr][6] = w ? "K" : "k";
        b[rr][5] = w ? "R" : "r";
        b[rr][7] = null;
      } else {
        b[rr][4] = null;
        b[rr][2] = w ? "K" : "k";
        b[rr][3] = w ? "R" : "r";
        b[rr][0] = null;
      }
    } else if (m.ep) {
      b[m.r][m.c] = null;
      const pr = w ? m.toR + 1 : m.toR - 1;
      b[pr][m.toC] = null;
      b[m.toR][m.toC] = piece;
    } else {
      b[m.r][m.c] = null;
      b[m.toR][m.toC] = m.promo ? (w ? "Q" : "q") : piece;
    }
    if (w) {
      if (piece === "K") ca &= ~3;
      if (m.r === 7 && m.c === 0) ca &= ~2;
      if (m.r === 7 && m.c === 7) ca &= ~1;
    } else {
      if (piece === "k") ca &= ~12;
      if (m.r === 0 && m.c === 0) ca &= ~8;
      if (m.r === 0 && m.c === 7) ca &= ~4;
    }
    if (m.cap) {
      const tp = target;
      if (tp === "R" && m.toR === 7 && m.toC === 0) ca &= ~2;
      if (tp === "R" && m.toR === 7 && m.toC === 7) ca &= ~1;
      if (tp === "r" && m.toR === 0 && m.toC === 0) ca &= ~8;
      if (tp === "r" && m.toR === 0 && m.toC === 7) ca &= ~4;
    }
    if (m.ep) {
      const pr = w ? m.toR + 1 : m.toR - 1;
      const t2 = st.b[pr][m.toC];
      if (t2 === "R" && pr === 7 && m.toC === 0) ca &= ~2;
      if (t2 === "R" && pr === 7 && m.toC === 7) ca &= ~1;
      if (t2 === "r" && pr === 0 && m.toC === 0) ca &= ~8;
      if (t2 === "r" && pr === 0 && m.toC === 7) ca &= ~4;
    }
    const ep2 = m.double
      ? { r: (m.r + m.toR) >> 1, c: m.c }
      : null;
    let h = st.half;
    if (m.cast || m.cap || m.ep) h = 0;
    else if (piece.toLowerCase() === "p") h = 0;
    else h = st.half + 1;
    if (h >= 100) h = 100;
    return { b, wtm: !w, ca, ep: ep2, half: h };
  }

  function legalMoves(st) {
    const w = st.wtm;
    const out = [];
    for (const m of genPseudo(st)) {
      const nst = applyMoveFixed(st, m);
      if (!nst) continue;
      if (!inCheck(nst, w)) out.push(m);
    }
    return out;
  }

  function evalStatic(st) {
    const b = st.b;
    let s = 0;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = b[r][c];
        if (!p) continue;
        const v = pieceVal(p);
        s += isW(p) ? v : -v;
      }
    }
    if (!st.wtm) s = -s;
    return s;
  }

  function mvvLva(m, st) {
    const t = st.b[m.toR][m.toC];
    const at = st.b[m.r][m.c];
    if (m.ep) return 10_000;
    if (!t && m.cap) return 0;
    if (!m.cap) return 0;
    return 1000 * pieceVal(t) - pieceVal(at);
  }

  function negamax(st, depth, a, b, level) {
    if (st.half >= 100) return 0;
    const wtm = st.wtm;
    const moves = legalMoves(st);
    if (!moves.length) {
      if (inCheck(st, wtm)) {
        return -MATE - depth;
      }
      return 0;
    }
    if (depth <= 0) {
      if (moves.some((m) => m.cap || m.ep) && level >= 3) {
        return quiesce(st, a, b, 2);
      }
      return evalStatic(st);
    }
    moves.sort((m1, m2) => mvvLva(m2, st) - mvvLva(m1, st));
    let best = -1e9;
    for (const m of moves) {
      const nst = applyMoveFixed(st, m);
      if (!nst) continue;
      const v = -negamax(nst, depth - 1, -b, -a, level);
      if (v > best) best = v;
      if (best > a) a = best;
      if (a >= b) break;
    }
    return best;
  }

  function quiesce(st, a, b, d) {
    const stand = evalStatic(st);
    if (d <= 0) return stand;
    if (stand >= b) return stand;
    if (stand > a) a = stand;
    const moves = legalMoves(st).filter((m) => m.cap || m.ep);
    if (!moves.length) return stand;
    moves.sort((m1, m2) => mvvLva(m2, st) - mvvLva(m1, st));
    let best = stand;
    for (const m of moves) {
      const nst = applyMoveFixed(st, m);
      if (!nst) continue;
      const v = -quiesce(nst, -b, -a, d - 1);
      if (v > best) best = v;
      if (v > a) a = v;
      if (a >= b) break;
    }
    return best;
  }

  function findEngineMove(st, level) {
    const depth = DEPTH_PLIES[level];
    const moves = legalMoves(st);
    if (!moves.length) return null;
    let bestM = null;
    let bestV = -1e9;
    const order = moves.slice();
    order.sort((m1, m2) => mvvLva(m2, st) - mvvLva(m1, st));
    for (const m of order) {
      const nst = applyMoveFixed(st, m);
      if (!nst) continue;
      const v = -negamax(nst, depth - 1, -1e9, 1e9, level) + (level === 1 ? (Math.random() - 0.5) * 6 : 0);
      if (v > bestV) {
        bestV = v;
        bestM = m;
      }
    }
    return bestM;
  }

  const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

  const ChessPlay = (() => {
    let st = null;
    let selected = null;
    let lastMove = null;
    let legal = [];
    let thinking = false;
    let over = false;
    let netOnline = false;
    let netIsWhite = true;

    function setStatus(t, k = "") {
      const s = $("#chessPlayStatus");
      s.textContent = t;
      s.className = "chess-status" + (k ? ` ${k}` : "");
    }

    function renderBoard() {
      const el = $("#chessPlayBoard");
      if (!el) return;
      el.innerHTML = "";
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const sq = document.createElement("div");
          const isLight = (r + c) % 2 === 0;
          sq.className = `chess-sq ${isLight ? "light" : "dark"}`;
          sq.dataset.sq = rcSq(r, c);
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
          const p = st.b[r][c];
          if (p) {
            const sp = document.createElement("span");
            sp.className = `chess-piece ${isW(p) ? "white" : "black"}`;
            sp.textContent = GLY[p];
            sq.appendChild(sp);
          }
          if (selected && selected.r === r && selected.c === c) sq.classList.add("selected");
          if (lastMove && (lastMove.f === rcSq(r, c) || lastMove.t === rcSq(r, c))) {
            sq.classList.add("last-move");
            if (isLight) sq.classList.add("light");
            else sq.classList.add("dark");
          }
          for (const m of legal) {
            if (m.toR === r && m.toC === c) {
              sq.classList.add("legal-dest");
              break;
            }
          }
          sq.addEventListener("click", () => onSq(r, c));
          el.appendChild(sq);
        }
      }
    }

    function myTurn() {
      if (!st) return false;
      if (netOnline) return st.wtm === netIsWhite;
      return st.wtm;
    }

    function isMyPiece(piece) {
      if (!piece) return false;
      return netOnline ? isW(piece) === netIsWhite : isW(piece);
    }

    function syncLegal() {
      legal = [];
      if (!st || over || thinking) return;
      if (!myTurn()) return;
      if (selected) {
        const mvs = legalMoves(st);
        legal = mvs.filter((m) => m.r === selected.r && m.c === selected.c);
      }
    }

    function onSq(r, c) {
      if (thinking || over || !st) return;
      if (!myTurn()) return;
      const piece = st.b[r][c];
      if (selected) {
        const hit = legal.find((m) => m.toR === r && m.toC === c);
        if (hit) {
          applyUser(hit);
          return;
        }
        if (piece && isMyPiece(piece)) {
          if (selected.r === r && selected.c === c) {
            selected = null;
            legal = [];
            renderBoard();
            return;
          }
          selected = { r, c };
          syncLegal();
          renderBoard();
          return;
        }
        selected = null;
        legal = [];
        renderBoard();
        return;
      }
      if (piece && isMyPiece(piece)) {
        selected = { r, c };
        syncLegal();
        renderBoard();
      }
    }

    function afterPlayer(st2) {
      st = st2;
      selected = null;
      legal = [];
      renderBoard();
      if (st.half >= 100) {
        setStatus("Draw (50-move rule).", "muted");
        over = true;
        if (netOnline && window.bicSendRoomMove) {
          try {
            window.bicSendRoomMove("chess", { fen: stateToFen(st) });
          } catch { /* */ }
        }
        return;
      }
      if (!inCheck(st, st.wtm) && !legalMoves(st).length) {
        setStatus("Draw (stalemate).", "muted");
        over = true;
        if (netOnline && window.bicSendRoomMove) {
          try {
            window.bicSendRoomMove("chess", { fen: stateToFen(st) });
          } catch { /* */ }
        }
        return;
      }
      if (inCheck(st, st.wtm) && !legalMoves(st).length) {
        setStatus(st.wtm ? "Checkmate. Black wins." : "Checkmate. White wins.", st.wtm ? "error" : "success");
        over = true;
        if (netOnline && window.bicSendRoomMove) {
          try {
            window.bicSendRoomMove("chess", { fen: stateToFen(st) });
          } catch { /* */ }
        }
        return;
      }
      if (netOnline) {
        try {
          window.bicSendRoomMove("chess", { fen: stateToFen(st) });
        } catch { /* */ }
        if (over) return;
        setStatus(
          st.wtm === netIsWhite ? "Your turn." : "Opponent’s turn — waiting…",
          "",
        );
        return;
      }
      if (!st.wtm) {
        setStatus("Computer is thinking…", "muted");
        thinking = true;
        setTimeout(() => {
          const lv = cpuLevel();
          const em = findEngineMove(st, lv);
          thinking = false;
          if (!em) {
            if (!inCheck(st, false)) setStatus("Draw (stalemate).", "muted");
            else setStatus("Checkmate. White wins.", "success");
            over = true;
            renderBoard();
            return;
          }
          const nst2 = applyMoveFixed(st, em);
          st = nst2;
          lastMove = { f: rcSq(em.r, em.c), t: rcSq(em.toR, em.toC) };
          renderBoard();
          if (st.half >= 100) {
            setStatus("Draw (50-move rule).", "muted");
            over = true;
            return;
          }
          if (inCheck(st, true) && !legalMoves(st).length) {
            setStatus("Checkmate. Black wins.", "error");
            over = true;
            return;
          }
          if (!inCheck(st, true) && !legalMoves(st).length) {
            setStatus("Draw (stalemate).", "muted");
            over = true;
            return;
          }
          setStatus("Your turn (White).", "");
        }, 16);
      } else {
        setStatus("Your turn (White).", "");
      }
    }

    function applyUser(m) {
      const nst = applyMoveFixed(st, m);
      if (!nst) return;
      st = nst;
      lastMove = { f: rcSq(m.r, m.c), t: rcSq(m.toR, m.toC) };
      selected = null;
      legal = [];
      renderBoard();
      afterPlayer(st);
    }

    function newGame() {
      if (netOnline) return;
      st = parseFen(START);
      selected = null;
      lastMove = null;
      legal = [];
      thinking = false;
      over = false;
      if (inCheck(st, st.wtm) && !legalMoves(st).length) { /* */ }
      setStatus("Your turn (White).", "");
      renderBoard();
    }

    function setNetUi() {
      const dsel = document.getElementById("chessplaySettings");
      if (dsel) dsel.style.display = netOnline ? "none" : "";
      const leave = document.getElementById("chessPlayLeaveNet");
      if (leave) leave.style.display = netOnline ? "inline-block" : "none";
    }

    function clearOnline() {
      netOnline = false;
      netIsWhite = true;
      setNetUi();
    }

    function applyRemoteFen(fen) {
      if (!fen) return;
      try {
        st = parseFen(fen);
        selected = null;
        legal = [];
        thinking = false;
        over = false;
        if (st.half >= 100) {
          setStatus("Draw (50-move rule).", "muted");
          over = true;
        } else if (!inCheck(st, st.wtm) && !legalMoves(st).length) {
          setStatus("Draw (stalemate).", "muted");
          over = true;
        } else if (inCheck(st, st.wtm) && !legalMoves(st).length) {
          setStatus(st.wtm ? "Checkmate. Black wins." : "Checkmate. White wins.", st.wtm ? "error" : "success");
          over = true;
        } else {
          setStatus(
            st.wtm === netIsWhite ? "Your turn." : "Opponent’s turn — waiting…",
            "",
          );
        }
        renderBoard();
      } catch { /* */ }
    }

    function startOnlineFromLobby(isHost) {
      const pending = sessionStorage.getItem("bic_chess_start_fen");
      sessionStorage.removeItem("bic_chess_start_fen");
      netOnline = true;
      netIsWhite = !!isHost;
      over = false;
      thinking = false;
      st = parseFen(pending || START);
      selected = null;
      lastMove = null;
      legal = [];
      setNetUi();
      if (inCheck(st, st.wtm) && !legalMoves(st).length) {
        setStatus("Invalid position.", "error");
      } else {
        setStatus(
          netIsWhite
            ? "You are White. Online game — your move to start, or wait for opponent."
            : "You are Black. Online game — wait for White’s first move.",
          "",
        );
      }
      renderBoard();
    }

    function init() {
      const el = document.getElementById("chessPlayBoard");
      if (!el) return;
      const dsel = document.getElementById("chessplayDiff");
      if (dsel) {
        const v = cpuLevel();
        dsel.value = String(v);
        dsel.addEventListener("change", () => {
          const x = +dsel.value;
          store.set(CP_DIFF_KEY, x >= 1 && x <= 5 ? x : 3);
        });
      }
      const btn = document.getElementById("chessPlayNew");
      if (btn) btn.addEventListener("click", newGame);
      const leave = document.getElementById("chessPlayLeaveNet");
      if (leave) {
        leave.addEventListener("click", () => {
          clearOnline();
          newGame();
        });
      }
      window.bicStartChessOnline = (isHost) => {
        startOnlineFromLobby(!!isHost);
      };
      window.bicApplyChessFen = (fen) => {
        if (!fen) return;
        if (!netOnline) {
          sessionStorage.setItem("bic_chess_start_fen", fen);
          return;
        }
        applyRemoteFen(fen);
      };
      window.bicOnPeerLeftChess = function peerLeftChess() {
        if (netOnline) {
          setStatus("Opponent left the room. Leaving online mode.", "muted");
          clearOnline();
          newGame();
        }
      };
      newGame();
    }

    return { init };
  })();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => ChessPlay.init());
  } else {
    ChessPlay.init();
  }
})();
