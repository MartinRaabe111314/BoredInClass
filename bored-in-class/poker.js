/* ============================================================
   Texas Hold'em & Omaha Hi/Lo — 4-handed vs bots (oval table UI)
   ============================================================ */
(() => {
  "use strict";

  const NUM = 4;
  const SUITS = ["S", "H", "D", "C"];
  const SUIT_SYM = { S: "\u2660", H: "\u2665", D: "\u2666", C: "\u2663" };
  const RANK_LABEL = { 11: "J", 12: "Q", 13: "K", 14: "A", 10: "10" };

  function labelRank(r) {
    return RANK_LABEL[r] || String(r);
  }

  function shuffleDeck() {
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

  function combos(arr, k) {
    const out = [];
    function dfs(start, acc) {
      if (acc.length === k) {
        out.push(acc.slice());
        return;
      }
      for (let i = start; i < arr.length; i++) {
        acc.push(arr[i]);
        dfs(i + 1, acc);
        acc.pop();
      }
    }
    dfs(0, []);
    return out;
  }

  function straightHigh(srDescUnique) {
    const u = [...srDescUnique].sort((a, b) => b - a);
    if (u.includes(14) && u.includes(5) && u.includes(4) && u.includes(3) && u.includes(2)) return 5;
    for (let i = 0; i <= u.length - 5; i++) {
      let ok = true;
      for (let k = 0; k < 4; k++) {
        if (u[i + k] - u[i + k + 1] !== 1) {
          ok = false;
          break;
        }
      }
      if (ok) return u[i];
    }
    return 0;
  }

  function evaluate5(cs) {
    const ranks = cs.map((c) => c.rank).sort((a, b) => b - a);
    const suits = cs.map((c) => c.suit);
    const flush = suits.every((s) => s === suits[0]);
    const uniq = [...new Set(ranks)].sort((a, b) => b - a);
    const sh = straightHigh(uniq);

    const hist = {};
    for (const r of ranks) hist[r] = (hist[r] || 0) + 1;
    const pairs = Object.entries(hist)
      .map(([r, n]) => [Number(r), n])
      .sort((a, b) => b[1] - a[1] || b[0] - a[0]);

    if (flush && sh) return { cat: 1, tiebreak: [sh === 5 ? 5 : sh] };
    if (pairs[0][1] === 4) {
      const q = pairs[0][0];
      const k = ranks.find((r) => r !== q);
      return { cat: 2, tiebreak: [q, k] };
    }
    if (pairs[0][1] === 3 && pairs[1] && pairs[1][1] === 2) {
      return { cat: 3, tiebreak: [pairs[0][0], pairs[1][0]] };
    }
    if (flush) return { cat: 4, tiebreak: ranks.slice() };
    if (sh) return { cat: 5, tiebreak: [sh === 5 ? 5 : sh] };
    if (pairs[0][1] === 3) {
      const t = pairs[0][0];
      const kick = ranks.filter((r) => r !== t);
      return { cat: 6, tiebreak: [t, ...kick] };
    }
    if (pairs.length >= 2 && pairs[0][1] === 2 && pairs[1][1] === 2) {
      const hi = Math.max(pairs[0][0], pairs[1][0]);
      const lo = Math.min(pairs[0][0], pairs[1][0]);
      const k = ranks.find((r) => r !== pairs[0][0] && r !== pairs[1][0]);
      return { cat: 7, tiebreak: [hi, lo, k] };
    }
    if (pairs[0][1] === 2) {
      const p = pairs[0][0];
      const kick = ranks.filter((r) => r !== p);
      return { cat: 8, tiebreak: [p, ...kick] };
    }
    return { cat: 9, tiebreak: ranks.slice() };
  }

  function cmpEval(a, b) {
    if (a.cat !== b.cat) return a.cat < b.cat ? 1 : -1;
    for (let i = 0; i < Math.max(a.tiebreak.length, b.tiebreak.length); i++) {
      const x = a.tiebreak[i] || 0;
      const y = b.tiebreak[i] || 0;
      if (x !== y) return x > y ? 1 : -1;
    }
    return 0;
  }

  function evalName(ev) {
    const names = {
      1: "Straight flush",
      2: "Four of a kind",
      3: "Full house",
      4: "Flush",
      5: "Straight",
      6: "Three of a kind",
      7: "Two pair",
      8: "Pair",
      9: "High card",
    };
    return names[ev.cat] || "Hand";
  }

  function bestHoldem(hole2, board5) {
    const all = hole2.concat(board5);
    let best = null;
    for (const pick of combos(all, 5)) {
      const ev = evaluate5(pick);
      if (!best || cmpEval(ev, best) > 0) best = ev;
    }
    return best;
  }

  function bestOmahaHigh(hole4, board5) {
    let best = null;
    for (const h of combos(hole4, 2)) {
      for (const bb of combos(board5, 3)) {
        const ev = evaluate5(h.concat(bb));
        if (!best || cmpEval(ev, best) > 0) best = ev;
      }
    }
    return best;
  }

  function lowRankVal(r) {
    return r === 14 ? 1 : r;
  }

  function bestOmahaLow(hole4, board5) {
    let bestKey = null;
    for (const h of combos(hole4, 2)) {
      for (const bb of combos(board5, 3)) {
        const five = h.concat(bb);
        const lr = five.map((c) => lowRankVal(c.rank)).sort((a, b) => a - b);
        const uniq = [...new Set(lr)].sort((a, b) => a - b);
        if (uniq.length !== 5) continue;
        if (uniq[uniq.length - 1] > 8) continue;
        const key = uniq.slice().sort((a, b) => b - a);
        if (!bestKey || cmpLow(key, bestKey) < 0) bestKey = key;
      }
    }
    return bestKey ? { key: bestKey } : null;
  }

  function cmpLow(a, b) {
    for (let i = 0; i < 5; i++) {
      if (a[i] !== b[i]) return a[i] - b[i];
    }
    return 0;
  }

  function botStrength(board, hole, variant) {
    if (board.length === 0) {
      return hole.reduce((s, c) => s + (c.rank >= 11 ? 14 : c.rank), 0);
    }
    const ev =
      variant === "holdem"
        ? bestHoldem(hole.slice(0, 2), board)
        : bestOmahaHigh(hole, board);
    return (10 - ev.cat) * 40 + (ev.tiebreak[0] || 0);
  }

  function CardEl(c, faceDown) {
    const red = c && (c.suit === "H" || c.suit === "D");
    const cls = red ? "pk-card pk-red" : "pk-card";
    if (faceDown || !c) return `<span class="${cls} pk-back" aria-hidden="true"></span>`;
    return `<span class="${cls}">${labelRank(c.rank)}${SUIT_SYM[c.suit]}</span>`;
  }

  function createGame(opts) {
    const { prefix, variant, holeCount, seatNames } = opts;
    const BB = 20;
    const SB = 10;
    const START = 1000;

    let state = {};
    let runTok = 0;

    function $(id) {
      return document.getElementById(prefix + id);
    }

    function schedule(fn, ms) {
      const t = runTok;
      setTimeout(() => {
        if (t === runTok) fn();
      }, ms);
    }

    function msg(text) {
      const el = $("Msg");
      if (el) el.textContent = text;
    }

    function aliveIndices() {
      const a = [];
      for (let i = 0; i < NUM; i++) {
        if (!state.players[i].folded) a.push(i);
      }
      return a;
    }

    function maxFacingAmongAlive() {
      const al = aliveIndices();
      if (!al.length) return 0;
      return Math.max(...al.map((i) => state.players[i].streetContrib));
    }

    function minBumpNow() {
      return Math.max(BB, state.streetRaiseBump);
    }

    /** Folded / all-in with no chips left cannot act; others owe chips or still owe an action (check). */
    function needsAction(seat) {
      const p = state.players[seat];
      if (p.folded) return false;
      if (p.stack <= 0) return false;
      const mx = maxFacingAmongAlive();
      if (p.streetContrib < mx) return true;
      if (!state.actedThisStreet[seat]) return true;
      return false;
    }

    function bettingRoundComplete() {
      const al = aliveIndices();
      if (al.length <= 1) return true;
      return al.every((i) => !needsAction(i));
    }

    /** Next clockwise seat after `from` that still needs to act (call, check, raise). */
    function nextActorSeat(from) {
      for (let k = 1; k <= NUM + 2; k++) {
        const i = (from + k) % NUM;
        if (needsAction(i)) return i;
      }
      return null;
    }

    /**
     * Minimum total street contribution for `seat` to open or raise legally (NL).
     * Short all-in below this is allowed as an all-in push.
     */
    function minRaiseStreetTotal(seat) {
      const mx = maxFacingAmongAlive();
      const extra = minBumpNow();
      return mx + extra;
    }

    function applyRaiseTotal(seat, targetStreetTotal) {
      const me = state.players[seat];
      const mxOld = maxFacingAmongAlive();
      const maxAffordable = me.streetContrib + me.stack;
      let target = Math.min(Math.floor(targetStreetTotal), maxAffordable);
      const minRaiseLevel = minRaiseStreetTotal(seat);

      if (target <= me.streetContrib) return false;

      /* Raise (not just call): must reach min legal facing unless shoving all chips short of it */
      if (target > mxOld && target < minRaiseLevel && target < maxAffordable) {
        target = Math.min(minRaiseLevel, maxAffordable);
      }

      const delta = target - me.streetContrib;
      if (delta <= 0 || delta > me.stack) return false;

      me.stack -= delta;
      me.streetContrib += delta;
      state.pot += delta;

      const mxNew = maxFacingAmongAlive();
      if (mxNew > mxOld) state.streetRaiseBump = mxNew - mxOld;

      state.actedThisStreet[seat] = true;
      return true;
    }

    /** Preset raise amounts for UI / bots: min legal raise, ~half pot, ~pot, all-in. */
    function raisePresetsForSeat(seat) {
      const me = state.players[seat];
      const mx = maxFacingAmongAlive();
      const pot = state.pot;
      const maxTot = me.streetContrib + me.stack;
      const minTot = Math.min(minRaiseStreetTotal(seat), maxTot);
      const halfExtra = Math.floor(pot * 0.55);
      const potExtra = Math.floor(pot * 0.9);
      const halfTot = Math.min(mx + Math.max(minBumpNow(), halfExtra), maxTot);
      const potTot = Math.min(mx + Math.max(minBumpNow(), potExtra), maxTot);
      return {
        min: minTot,
        halfPot: Math.max(minTot, halfTot),
        pot: Math.max(minTot, potTot),
        allIn: maxTot,
      };
    }

    function normalizedStrength(board, hole, vr) {
      let raw = botStrength(board, hole, vr);
      if (variant === "omaha8") {
        const lo = bestOmahaLow(hole, board);
        if (lo) raw += 55;
      }
      return Math.min(1, raw / 430);
    }

    function renderAll(faceBots) {
      const comm = $("Comm");
      if (comm) comm.innerHTML = (state.board || []).map((c) => CardEl(c)).join("");
      const hole = $("Hole");
      if (hole) hole.innerHTML = (state.players[0].hole || []).map((c) => CardEl(c)).join("");

      const st = $("Stack");
      const pt = $("Pot");
      const pm = $("Potmid");
      if (st) st.textContent = String(state.players[0].stack);
      if (pt) pt.textContent = String(state.pot);
      if (pm) pm.textContent = String(state.pot);

      for (let si = 1; si < NUM; si++) {
        const seatEl = $("Seat" + si);
        if (!seatEl) continue;
        const p = state.players[si];
        const cards =
          faceBots || state.phase === "done"
            ? (p.hole || []).map((c) => CardEl(c))
            : new Array(holeCount).fill(null).map(() => CardEl(null, true));
        const btn = state.button === si ? " \u2022 D" : "";
        const sub =
          state.phase === "bet" && state.toAct === si ? '<span class="poker-turn-dot"></span>' : "";
        seatEl.innerHTML = `<div class="poker-mini-name">${sub}${seatNames[si]}${btn}</div><div class="poker-mini-cards">${cards.join("")}</div><div class="poker-mini-stack">${p.folded ? "Fold" : p.stack}</div>`;
      }
    }

    function renderActions() {
      const box = $("Actions");
      if (!box) return;
      box.innerHTML = "";
      if (state.phase !== "bet" || state.toAct !== 0) return;

      const me = state.players[0];
      const mx = maxFacingAmongAlive();
      const toCall = Math.max(0, mx - me.streetContrib);
      const rp = raisePresetsForSeat(0);
      const maxTot = me.streetContrib + me.stack;

      const row1 = document.createElement("div");
      row1.className = "poker-act-row";

      const fold = document.createElement("button");
      fold.type = "button";
      fold.className = "btn ghost";
      fold.textContent = "Fold";
      fold.addEventListener("click", () => humanAct("fold"));

      const call = document.createElement("button");
      call.type = "button";
      call.className = "btn";
      call.textContent = toCall === 0 ? "Check" : `Call ${toCall}`;
      call.addEventListener("click", () => humanAct(toCall === 0 ? "check" : "call"));

      row1.appendChild(fold);
      row1.appendChild(call);
      box.appendChild(row1);

      if (maxTot > mx) {
        const row2 = document.createElement("div");
        row2.className = "poker-act-row poker-act-bets";

        const mkRaise = (label, total) => {
          const b = document.createElement("button");
          b.type = "button";
          b.className = "btn";
          b.textContent = label;
          b.disabled = total <= me.streetContrib || total > maxTot;
          b.addEventListener("click", () => humanAct("raise", total));
          return b;
        };

        const openWord = toCall === 0 ? "Bet" : "Raise";

        if (rp.min > me.streetContrib && rp.min <= maxTot) {
          row2.appendChild(mkRaise(`${openWord} ${rp.min}`, rp.min));
        }
        if (rp.halfPot > rp.min && rp.halfPot <= maxTot) {
          row2.appendChild(mkRaise(`${openWord} ${rp.halfPot}`, rp.halfPot));
        }
        if (rp.pot > rp.halfPot && rp.pot <= maxTot) {
          row2.appendChild(mkRaise(`${openWord} ${rp.pot}`, rp.pot));
        }
        if (maxTot > mx && maxTot > (rp.min || 0)) {
          row2.appendChild(mkRaise(`All-in ${maxTot}`, maxTot));
        }

        box.appendChild(row2);
      }
    }

    function humanAct(kind, raiseTotal) {
      if (state.phase !== "bet" || state.toAct !== 0) return;
      apply(0, kind, raiseTotal);
    }

    function showResultBackdrop(summaryText) {
      msg(summaryText);
      const bd = $("ResultBackdrop");
      const tx = $("ResultText");
      const ok = $("ResultOk");
      if (!bd || !tx || !ok) {
        schedule(dealHand, 120);
        return;
      }
      tx.textContent = summaryText;
      bd.hidden = false;
      ok.addEventListener(
        "click",
        () => {
          bd.hidden = true;
          dealHand();
        },
        { once: true },
      );
    }

    function hideResultBackdrop() {
      const bd = $("ResultBackdrop");
      if (bd) bd.hidden = true;
    }

    function awardPotToWinner(winnerSeat) {
      const potAmt = state.pot;
      state.players[winnerSeat].stack += potAmt;
      const text = `${seatNames[winnerSeat]} wins ${potAmt} chips`;
      state.pot = 0;
      state.phase = "done";
      renderAll(true);
      renderActions();
      showResultBackdrop(text);
    }

    function apply(seat, kind, raiseTotal) {
      const me = state.players[seat];
      const mx = maxFacingAmongAlive();
      const toCall = Math.max(0, mx - me.streetContrib);

      if (kind === "raise") {
        const ok = applyRaiseTotal(seat, raiseTotal);
        if (!ok) return;
        if (aliveIndices().length === 1) {
          awardPotToWinner(aliveIndices()[0]);
          return;
        }
        pumpBetAfter(seat);
        return;
      }

      if (kind === "fold") {
        me.folded = true;
        state.actedThisStreet[seat] = true;
        const al = aliveIndices();
        if (al.length === 1) {
          awardPotToWinner(al[0]);
          return;
        }
        pumpBetAfter(seat);
        return;
      }
      if (kind === "check" && toCall === 0) {
        state.actedThisStreet[seat] = true;
      } else if (kind === "call") {
        const pay = Math.min(toCall, me.stack);
        me.stack -= pay;
        me.streetContrib += pay;
        state.pot += pay;
        state.actedThisStreet[seat] = true;
      }

      if (aliveIndices().length === 1) {
        awardPotToWinner(aliveIndices()[0]);
        return;
      }

      pumpBetAfter(seat);
    }

    function pumpBetAfter(lastSeat) {
      if (bettingRoundComplete()) {
        nextStreet();
        return;
      }
      const nxt = nextActorSeat(lastSeat);
      if (nxt === null) {
        nextStreet();
        return;
      }
      state.toAct = nxt;
      msg(`${seatNames[nxt]}${nxt === 0 ? " — your turn" : ""}`);
      renderAll(false);
      renderActions();
      if (nxt !== 0) schedule(() => botPlay(nxt), 480);
    }

    function botPlay(seat) {
      if (runTok !== state.__tok) return;
      if (state.phase !== "bet" || state.toAct !== seat) return;
      const p = state.players[seat];
      const mx = maxFacingAmongAlive();
      const toCall = Math.max(0, mx - p.streetContrib);
      const vr = variant === "holdem" ? "holdem" : "omaha8";
      const eq = normalizedStrength(state.board, p.hole, vr);
      const pot = state.pot;
      const potOdds = toCall > 0 ? toCall / (pot + toCall + 1e-9) : 0;
      const rp = raisePresetsForSeat(seat);
      const maxTot = p.streetContrib + p.stack;

      if (toCall > 0) {
        const oddsAdj = eq > 0.58 ? 0.03 : eq > 0.44 ? 0 : -0.025;
        const mustCall = eq >= potOdds + oddsAdj;

        if (!mustCall && eq < 0.36 && Math.random() < 0.82) {
          apply(seat, "fold");
          return;
        }
        if (!mustCall && eq < potOdds - 0.045 && Math.random() < 0.68) {
          apply(seat, "fold");
          return;
        }

        if (eq > 0.76 && maxTot > mx && Math.random() < 0.44) {
          const tgt = Math.min(rp.pot + Math.floor(Math.random() * 100), rp.allIn);
          if (applyRaiseTotal(seat, tgt)) {
            pumpBetAfter(seat);
            return;
          }
        }
        if (eq > 0.62 && maxTot > mx && Math.random() < 0.28 && minRaiseStreetTotal(seat) <= maxTot) {
          const tgt = Math.min(rp.halfPot + Math.floor(Math.random() * 40), rp.allIn);
          if (applyRaiseTotal(seat, tgt)) {
            pumpBetAfter(seat);
            return;
          }
        }

        apply(seat, "call");
        return;
      }

      if (maxTot <= mx) {
        apply(seat, "check");
        return;
      }

      const openFreq = eq > 0.67 ? 0.62 : eq > 0.52 ? 0.4 : eq > 0.38 ? 0.2 : 0.09;
      if (Math.random() > openFreq) {
        apply(seat, "check");
        return;
      }

      let tgt = rp.min;
      if (eq > 0.64) tgt = Math.min(rp.halfPot + Math.floor(Math.random() * Math.max(1, rp.pot - rp.halfPot)), rp.allIn);
      else if (eq > 0.48) tgt = Math.min(rp.halfPot, rp.allIn);
      else tgt = rp.min;

      if (!applyRaiseTotal(seat, tgt)) apply(seat, "check");
      else pumpBetAfter(seat);
    }

    function nextStreet() {
      const deck = state.deck;
      if (state.street === "preflop") {
        state.street = "flop";
        state.board.push(deck.pop(), deck.pop(), deck.pop());
      } else if (state.street === "flop") {
        state.street = "turn";
        deck.pop();
        state.board.push(deck.pop());
      } else if (state.street === "turn") {
        state.street = "river";
        deck.pop();
        state.board.push(deck.pop());
      } else {
        showdown();
        return;
      }
      for (let i = 0; i < NUM; i++) {
        state.players[i].streetContrib = 0;
        state.actedThisStreet[i] = false;
      }
      state.streetRaiseBump = BB;

      const al = aliveIndices();
      if (al.length <= 1) {
        awardPotToWinner(al[0]);
        return;
      }

      let start = (state.button + 1) % NUM;
      while (state.players[start].folded) start = (start + 1) % NUM;
      state.toAct = start;
      msg(`${state.street.toUpperCase()} — ${seatNames[start]}${start === 0 ? " — your turn" : ""}`);
      renderAll(false);
      if (start === 0) renderActions();
      else schedule(() => botPlay(start), 480);
    }

    function showdownHoldemMulti(alive, board) {
      let bestEv = null;
      const winners = [];
      for (const i of alive) {
        const ev = bestHoldem(state.players[i].hole, board);
        const c = bestEv ? cmpEval(ev, bestEv) : 1;
        if (c > 0) {
          bestEv = ev;
          winners.length = 0;
          winners.push(i);
        } else if (c === 0) winners.push(i);
      }
      const share = Math.floor(state.pot / winners.length);
      winners.forEach((w) => {
        state.players[w].stack += share;
      });
      const names = winners.map((w) => seatNames[w]).join(" & ");
      return `${names} win ${share} each — ${evalName(bestEv)}`;
    }

    function showdownOmahaMulti(alive, board) {
      let bestHi = null;
      const winHi = [];
      for (const i of alive) {
        const ev = bestOmahaHigh(state.players[i].hole, board);
        const c = bestHi ? cmpEval(ev, bestHi) : 1;
        if (c > 0) {
          bestHi = ev;
          winHi.length = 0;
          winHi.push(i);
        } else if (c === 0) winHi.push(i);
      }

      const lowKeys = alive.map((i) => ({ i, lo: bestOmahaLow(state.players[i].hole, board) }));
      const qualify = lowKeys.filter((x) => x.lo);
      const pot = state.pot;

      if (qualify.length === 0) {
        const share = Math.floor(pot / winHi.length);
        winHi.forEach((w) => {
          state.players[w].stack += share;
        });
        return `High only — ${winHi.map((w) => seatNames[w]).join(" & ")} (+${share}) ${evalName(bestHi)}`;
      }

      let bestLo = null;
      const winLo = [];
      for (const { i, lo } of qualify) {
        const c = bestLo ? cmpLow(lo.key, bestLo.key) : -1;
        if (!bestLo || c < 0) {
          bestLo = lo;
          winLo.length = 0;
          winLo.push(i);
        } else if (c === 0) winLo.push(i);
      }

      const hiPot = Math.floor(pot / 2);
      const loPot = pot - hiPot;
      const hs = Math.floor(hiPot / winHi.length);
      winHi.forEach((w) => {
        state.players[w].stack += hs;
      });
      const ls = Math.floor(loPot / winLo.length);
      winLo.forEach((w) => {
        state.players[w].stack += ls;
      });
      return `Hi ${winHi.map((w) => seatNames[w]).join(" &")} +${hs} · Lo ${winLo.map((w) => seatNames[w]).join(" &")} +${ls}`;
    }

    function showdown() {
      state.phase = "done";
      renderAll(true);
      const board = state.board;
      const alive = aliveIndices();

      if (alive.length === 1) {
        awardPotToWinner(alive[0]);
        return;
      }

      const summary =
        variant === "holdem" ? showdownHoldemMulti(alive, board) : showdownOmahaMulti(alive, board);

      state.pot = 0;
      renderAll(true);
      renderActions();
      showResultBackdrop(summary);
    }

    function dealHand() {
      runTok++;
      state.__tok = runTok;
      hideResultBackdrop();
      const prevStacks =
        state.players && state.players.length === NUM
          ? state.players.map((p) => p.stack)
          : null;
      const deck = shuffleDeck();
      state.button = state.button === undefined ? 0 : (state.button + 1) % NUM;
      state.deck = deck;
      state.board = [];
      state.street = "preflop";
      state.pot = 0;
      state.phase = "bet";
      state.actedThisStreet = new Array(NUM).fill(false);
      state.streetRaiseBump = BB;

      state.players = [];
      for (let i = 0; i < NUM; i++) {
        state.players.push({
          name: seatNames[i],
          hole: [],
          folded: false,
          streetContrib: 0,
          stack: prevStacks ? prevStacks[i] : START,
        });
      }
      if (state.players.some((p) => p.stack <= 0)) {
        for (let i = 0; i < NUM; i++) state.players[i].stack = START;
      }

      for (let r = 0; r < holeCount; r++) {
        for (let i = 0; i < NUM; i++) state.players[i].hole.push(deck.pop());
      }

      const btn = state.button;
      const sbI = (btn + 1) % NUM;
      const bbI = (btn + 2) % NUM;
      state.btnIdx = btn;
      state.sbIdx = sbI;
      state.bbIdx = bbI;

      const sbP = state.players[sbI];
      const bbP = state.players[bbI];
      const sbb = Math.min(SB, sbP.stack);
      const bbb = Math.min(BB, bbP.stack);
      sbP.stack -= sbb;
      bbP.stack -= bbb;
      sbP.streetContrib = sbb;
      bbP.streetContrib = bbb;
      state.pot = sbb + bbb;

      const utg = (bbI + 1) % NUM;
      state.toAct = utg;
      msg(`Preflop — ${seatNames[utg]}${utg === 0 ? " — your turn (UTG)" : " opens"}`);
      renderAll(false);
      if (utg === 0) renderActions();
      else schedule(() => botPlay(utg), 480);
    }

    function init() {
      $("New")?.addEventListener("click", () => {
        hideResultBackdrop();
        dealHand();
      });
      state.button = undefined;
      dealHand();
    }

    return { init };
  }

  function boot() {
    const seats = ["You", "Ada", "Bo", "Cy"];
    createGame({
      prefix: "pkH",
      variant: "holdem",
      holeCount: 2,
      seatNames: seats,
    }).init();
    createGame({
      prefix: "pkO",
      variant: "omaha8",
      holeCount: 4,
      seatNames: seats,
    }).init();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
