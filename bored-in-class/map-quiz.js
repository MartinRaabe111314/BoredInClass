/* ============================================================
   Map quiz — world.svg or U.S. states (Simplemaps) + 4-wrong before reveal
   ============================================================ */
(() => {
  "use strict";

  function getCssMapColor(varName, fallback) {
    try {
      const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
      if (v) return v;
    } catch {
      /* ignore */
    }
    return fallback;
  }
  const WORLD_SVG_URL = "Map SVGs/world.svg";
  const US_SVG_URL = "Map SVGs/us.svg";
  const SESSION_REGION = "bicMapQuizRegion";
  const SESSION_MODE = "bicMapQuizMode";

  const MAX_WRONG = 4;
  /** ms before the next question after a correct answer (faster = snappier) */
  const SUCCESS_NEXT_MS = 600;
  const PERSIST_REVEALED = "map-persist-revealed";
  const SOLVE_CLASS = (wrongBeforeSuccess) =>
    `map-persist-solved-${Math.min(3, Math.max(0, wrongBeforeSuccess | 0))}`;

  function clearPersistSolvedClass(path) {
    for (let i = 0; i < 4; i += 1) {
      path.classList.remove(`map-persist-solved-${i}`);
    }
    path.classList.remove("map-persist-solved");
  }

  /** Round-only (not cleared when adding persist) — cleared each new question */
  const TRANSIENT_CLASSES = [
    "map-pulse-red-solid",
    "map-hit-ok",
    "map-hit-bad",
    "map-dim",
  ];

  /** Initial viewBox for map surface (world 2000×857, U.S. 1000×589) */
  const REGION_VIEW = {
    world: { vbx: 0, vby: 0, vbw: 2000, vbh: 857 },
    europe: { vbx: 880, vby: 30, vbw: 720, vbh: 400 },
    northamerica: { vbx: 50, vby: 50, vbw: 900, vbh: 500 },
    southamerica: { vbx: 480, vby: 300, vbw: 450, vbh: 540 },
    africa: { vbx: 920, vby: 280, vbw: 500, vbh: 520 },
    asia: { vbx: 1050, vby: 40, vbw: 950, vbh: 600 },
    oceania: { vbx: 1500, vby: 360, vbw: 500, vbh: 480 },
    us: { vbx: 0, vby: 0, vbw: 1000, vbh: 589 },
  };

  const REGION_TITLES = {
    world: "World",
    europe: "Europe",
    northamerica: "North America",
    southamerica: "South America",
    africa: "Africa",
    asia: "Asia",
    oceania: "Oceania",
    us: "United States (states)",
  };

  function getMapConfig() {
    let region = "world";
    let mode = "countries";
    try {
      const r = sessionStorage.getItem(SESSION_REGION);
      const m = sessionStorage.getItem(SESSION_MODE);
      if (r && typeof r === "string" && r in REGION_VIEW) region = r;
      if (m === "countries" || m === "capitals") mode = m;
    } catch {
      /* ignore */
    }
    return { region, mode, isUS: region === "us" };
  }

  function getBestStreakKey() {
    const { region, mode } = getMapConfig();
    return `bic.mapquiz.best.${region}.${mode}`;
  }

  function getRecordKeyPct(region, mode) {
    return `bic.mapquiz.record.pct.${region}.${mode}`;
  }

  function getRecordKeyTimeMs(region, mode) {
    return `bic.mapquiz.record.timeMs.${region}.${mode}`;
  }

  /** @param {string} [region] @param {string} [mode] */
  function recordFullClearIfVictory(region, mode) {
    const cfg = getMapConfig();
    const r = region != null ? region : cfg.region;
    const m = mode != null ? mode : cfg.mode;
    const n = countryList.length;
    if (n <= 0) return;
    const perfect = runSolvedTiers[0];
    const pct = Math.min(100, Math.round((100 * perfect) / n));
    if (runStartMs <= 0) return;
    const timeMs = Date.now() - runStartMs;
    const oldPct = store.get(getRecordKeyPct(r, m), -1);
    if (pct > oldPct) store.set(getRecordKeyPct(r, m), pct);
    const oldT = store.get(getRecordKeyTimeMs(r, m), null);
    if (oldT == null || timeMs < oldT) store.set(getRecordKeyTimeMs(r, m), timeMs);
  }

  function getInlineWorldSvg() {
    if (typeof window.__BIC_MAP_SVG === "string" && window.__BIC_MAP_SVG.length > 0) {
      return window.__BIC_MAP_SVG;
    }
    return null;
  }

  function getInlineUsSvg() {
    if (typeof window.__BIC_US_SVG === "string" && window.__BIC_US_SVG.length > 0) {
      return window.__BIC_US_SVG;
    }
    return null;
  }

  async function getSvgText() {
    const cfg = getMapConfig();
    if (cfg.isUS) {
      const inline = getInlineUsSvg();
      if (inline) return inline;
      const url = new URL(US_SVG_URL, document.baseURI || document.URL).toString();
      const res = await fetch(url);
      if (!res.ok) throw new Error(String(res.status));
      return res.text();
    }
    const inline = getInlineWorldSvg();
    if (inline) return inline;
    const url = new URL(WORLD_SVG_URL, document.baseURI || document.URL).toString();
    const res = await fetch(url);
    if (!res.ok) throw new Error(String(res.status));
    return res.text();
  }
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
        /* ignore */
      }
    },
  };

  const $ = (id) => document.getElementById(id);

  let currentTarget = null;
  let lastTargetId = null;
  let score = 0;
  let streak = 0;
  let bestStreak = 0;
  let round = 1;
  let inputLocked = false;
  let svgMapEl = null;
  /** Wrong clicks this round (0..3) */
  let wrongClicks = 0;
  /** @type {{ id: string, name: string }[]} */
  let countryList = [];
  /** @type {Map<string, string>} */
  let nameById = new Map();
  /** @type {{ reset: () => void } | null} */
  let mapViewNav = null;
  /** Ids found correctly this run. When all places are found, the run ends in victory. */
  const solvedIds = new Set();
  /** Counts per solve quality: index = wrong clicks before success (0..3) */
  let runSolvedTiers = [0, 0, 0, 0];
  /** Rounds where the answer was revealed after max wrong */
  let runReveals = 0;
  let runStartMs = 0;
  let victoryVisible = false;

  function slugClass(cls) {
    return "cls_" + cls.trim().toLowerCase().replace(/\s+/g, "_");
  }

  function countryKeyFromPath(path) {
    const rawId = path.getAttribute("id");
    if (rawId && rawId.trim()) return rawId.trim();
    const cls = path.getAttribute("class");
    if (cls && cls.trim()) return slugClass(cls);
    return null;
  }

  function countryNameFromPath(path) {
    const d = path.getAttribute("data-name");
    if (d && d.trim()) return d.trim();
    const n = path.getAttribute("name");
    if (n && n.trim()) return n.trim();
    const cls = path.getAttribute("class");
    if (cls && cls.trim()) return cls.trim();
    const id = path.getAttribute("id");
    return id && id.trim() ? id.trim() : "Unknown";
  }

  function continentForMapKey(k) {
    const t = window.__BIC_MAP_KEY_CONTINENT;
    if (t && typeof t === "object" && t[k] != null) return String(t[k]);
    return null;
  }

  function pickTarget() {
    if (countryList.length === 0) return null;
    const pool = countryList.filter((c) => !solvedIds.has(c.id));
    if (pool.length === 0) {
      return null;
    }
    const ids = pool.map((x) => x.id);
    let id = ids[Math.floor(Math.random() * ids.length)];
    if (ids.length > 1) {
      let guard = 0;
      while (id === lastTargetId && guard++ < 12) {
        id = ids[Math.floor(Math.random() * ids.length)];
      }
    }
    lastTargetId = id;
    return countryList.find((x) => x.id === id) || null;
  }

  function clearRoundTransientState() {
    if (!svgMapEl) return;
    svgMapEl.querySelectorAll("path.map-region").forEach((p) => {
      TRANSIENT_CLASSES.forEach((c) => p.classList.remove(c));
    });
  }

  function clearAllPersist() {
    if (!svgMapEl) return;
    svgMapEl.querySelectorAll("path.map-region").forEach((p) => {
      clearPersistSolvedClass(p);
      p.classList.remove(PERSIST_REVEALED);
    });
  }

  function updateGuessesLine() {
    const el = $("mapQuizGuesses");
    if (!el) return;
    if (inputLocked && wrongClicks >= MAX_WRONG) {
      el.textContent = "Round lost — answer shown on the map.";
      return;
    }
    const left = Math.max(0, MAX_WRONG - wrongClicks);
    el.textContent = `Wrong guesses: ${wrongClicks}/${MAX_WRONG} · ${left} allowed before the answer is revealed`;
  }

  function nextQuestion() {
    currentTarget = pickTarget();
    if (!currentTarget && countryList.length > 0 && solvedIds.size === countryList.length) {
      showVictoryScreen();
      return;
    }
    inputLocked = false;
    wrongClicks = 0;
    if ($("mapQuizTarget")) {
      $("mapQuizTarget").textContent = currentTarget
        ? currentTarget.name
        : "—";
    }
    if ($("mapQuizSkipBtn")) $("mapQuizSkipBtn").disabled = false;
    if ($("mapQuizRound")) $("mapQuizRound").textContent = `Round ${round}`;
    if (!svgMapEl) {
      if ($("mapQuizGuesses")) $("mapQuizGuesses").textContent = "Guesses left: —";
      return;
    }
    clearRoundTransientState();
    updateGuessesLine();
  }

  function updateHud() {
    if ($("mapQuizScore")) $("mapQuizScore").textContent = String(score);
    if ($("mapQuizStreak")) $("mapQuizStreak").textContent = String(streak);
    if ($("mapQuizBest")) $("mapQuizBest").textContent = String(bestStreak);
    if ($("mapQuizStatus")) {
      $("mapQuizStatus").textContent = "";
      $("mapQuizStatus").classList.remove("ok", "bad");
    }
  }

  function formatRunDurationMs(ms) {
    if (ms < 0) ms = 0;
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}m ${String(r).padStart(2, "0")}s`;
  }

  const MAP_SELECT_REGIONS = [
    "europe",
    "northamerica",
    "southamerica",
    "world",
    "africa",
    "asia",
    "oceania",
    "us",
  ];

  function refreshMapSelectPreviews() {
    const mode = "countries";
    for (let i = 0; i < MAP_SELECT_REGIONS.length; i += 1) {
      const region = MAP_SELECT_REGIONS[i];
      const card = document.querySelector(`[data-bic-card-region="${region}"]`);
      const el = card && card.querySelector(".map-select-best");
      if (!el) continue;
      const pct = store.get(getRecordKeyPct(region, mode), null);
      const tms = store.get(getRecordKeyTimeMs(region, mode), null);
      if (pct == null && tms == null) {
        el.textContent = "—";
        continue;
      }
      const parts = [];
      if (pct != null) parts.push(`Best ${pct}%`);
      if (tms != null) parts.push(formatRunDurationMs(tms));
      el.textContent = parts.join(" · ");
    }
  }

  function hideVictoryScreen() {
    const ov = $("mapQuizVictory");
    if (ov) {
      ov.hidden = true;
      ov.setAttribute("aria-hidden", "true");
    }
    victoryVisible = false;
    if ($("mapQuizSkipBtn")) $("mapQuizSkipBtn").disabled = false;
  }

  function showVictoryScreen() {
    recordFullClearIfVictory();
    refreshMapSelectPreviews();
    const ov = $("mapQuizVictory");
    if (!ov) return;
    victoryVisible = true;
    inputLocked = true;
    if ($("mapQuizSkipBtn")) $("mapQuizSkipBtn").disabled = true;
    if ($("mapQuizStatus")) {
      $("mapQuizStatus").textContent = "";
      $("mapQuizStatus").classList.remove("ok", "bad");
    }
    if ($("mapQuizTarget")) $("mapQuizTarget").textContent = "All found!";
    if ($("mapQuizRound")) $("mapQuizRound").textContent = "Complete";
    if ($("mapQuizGuesses")) $("mapQuizGuesses").textContent = "Every place on the map for this round.";

    const cfg = getMapConfig();
    const n = countryList.length;
    const isUS = cfg.isUS;
    const lead = $("mapQuizVictoryLead");
    if (lead) {
      lead.textContent = isUS
        ? `You found all ${n} state${n === 1 ? "" : "s"}.`
        : n === 1
          ? "You found the only place in this set."
          : `You found all ${n} countries and territories in this round.`;
    }
    const title = $("mapQuizVictoryTitle");
    if (title) title.textContent = "Map complete!";

    const roundsPlayed = Math.max(0, round - 1);
    const dur = runStartMs > 0 ? formatRunDurationMs(Date.now() - runStartMs) : "—";
    const stats = $("mapQuizVictoryStats");
    if (stats) {
      const rows = [
        ["Score", String(score)],
        ["Ending streak", String(streak)],
        ["Best streak (saved)", String(bestStreak)],
        ["Time", dur],
        ["Rounds played (incl. skips)", String(roundsPlayed)],
        ["Perfect (0 wrong)", String(runSolvedTiers[0])],
        ["1 wrong before right", String(runSolvedTiers[1])],
        ["2 wrong before right", String(runSolvedTiers[2])],
        ["3 wrong before right", String(runSolvedTiers[3])],
      ];
      if (runReveals > 0) {
        rows.push(["Revealed after max wrong", String(runReveals)]);
      }
      stats.innerHTML = rows
        .map(
          ([k, v]) =>
            `<div class="map-quiz-victory-stat"><span class="map-quiz-victory-stat-k">${k}</span><span class="map-quiz-victory-stat-v">${v}</span></div>`,
        )
        .join("");
    }
    ov.hidden = false;
    ov.setAttribute("aria-hidden", "false");
    setTimeout(() => {
      const btn = $("mapQuizVictoryAgain");
      if (btn) btn.focus();
    }, 0);
  }

  function pathsForId(id) {
    if (!svgMapEl) return [];
    return Array.from(
      svgMapEl.querySelectorAll(`path.map-region[data-id="${CSS.escape(id)}"]`),
    );
  }

  /**
   * Wheel = zoom, drag = pan (viewBox). Clicks on countries are skipped after a pan gesture.
   * When `lock` is set (region / U.S.), view stays within that rectangle — cannot zoom out past it.
   * @param {{ vbx: number, vby: number, vbw: number, vbh: number } | null} initialView
   * @param {{ vbx: number, vby: number, vbw: number, vbh: number } | null} lock — max visible area (same as region frame)
   */
  function initMapViewNav(surface, svg, worldW, worldH, initialView, lock) {
    const wx = 0;
    const wy = 0;
    const useLock = Boolean(lock && lock.vbw > 0 && lock.vbh > 0);
    const minVbW = useLock
      ? Math.min(180, lock.vbw * 0.12)
      : Math.min(180, worldW * 0.12);
    let start;
    if (initialView && initialView.vbw > 0 && initialView.vbh > 0) {
      start = { ...initialView };
    } else if (useLock) {
      start = { vbx: lock.vbx, vby: lock.vby, vbw: lock.vbw, vbh: lock.vbh };
    } else {
      start = { vbx: wx, vby: wy, vbw: worldW, vbh: worldH };
    }
    const state = {
      vbx: start.vbx,
      vby: start.vby,
      vbw: start.vbw,
      vbh: start.vbh,
    };
    const apply = () => {
      svg.setAttribute("viewBox", `${state.vbx} ${state.vby} ${state.vbw} ${state.vbh}`);
    };
    const clamp = () => {
      if (useLock) {
        if (state.vbw >= lock.vbw - 0.5) {
          state.vbx = lock.vbx;
          state.vby = lock.vby;
          state.vbw = lock.vbw;
          state.vbh = lock.vbh;
          return;
        }
        state.vbw = Math.max(minVbW, Math.min(lock.vbw, state.vbw));
        const ar = state.vbh / state.vbw;
        state.vbh = state.vbw * ar;
        state.vbx = Math.max(lock.vbx, Math.min(state.vbx, lock.vbx + lock.vbw - state.vbw));
        state.vby = Math.max(lock.vby, Math.min(state.vby, lock.vby + lock.vbh - state.vbh));
      } else {
        if (state.vbw >= worldW - 0.5) {
          state.vbx = wx;
          state.vby = wy;
          state.vbw = worldW;
          state.vbh = worldH;
          return;
        }
        state.vbw = Math.min(worldW, Math.max(minVbW, state.vbw));
        const ar = state.vbh / state.vbw;
        state.vbh = state.vbw * ar;
        state.vbx = Math.max(wx, Math.min(state.vbx, wx + worldW - state.vbw));
        state.vby = Math.max(wy, Math.min(state.vby, wy + worldH - state.vbh));
      }
    };
    const clientToUser = (e) => {
      const ctm = svg.getScreenCTM();
      if (!ctm) return null;
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      return pt.matrixTransform(ctm.inverse());
    };

    const onWheel = (e) => {
      e.preventDefault();
      const p = clientToUser(e);
      if (!p) return;
      const ar = state.vbh / state.vbw;
      const k = e.deltaY < 0 ? 0.9 : 1.11;
      let newW = state.vbw * k;
      if (useLock) {
        newW = Math.max(minVbW, Math.min(lock.vbw, newW));
      } else {
        newW = Math.min(worldW, Math.max(minVbW, newW));
      }
      const newH = newW * ar;
      const mx = (p.x - state.vbx) / state.vbw;
      const my = (p.y - state.vby) / state.vbh;
      state.vbx = p.x - mx * newW;
      state.vby = p.y - my * newH;
      state.vbw = newW;
      state.vbh = newH;
      clamp();
      apply();
    };

    let pan = null;
    let blockNextClick = false;
    const SLOP_PX = 8;
    const onDown = (e) => {
      if (e.button !== 0) return;
      blockNextClick = false;
      pan = {
        x0: e.clientX,
        y0: e.clientY,
        vbx0: state.vbx,
        vby0: state.vby,
        vbw0: state.vbw,
        vbh0: state.vbh,
        pid: e.pointerId,
        committed: false,
      };
    };
    const onMove = (e) => {
      if (!pan) return;
      if (e.pointerId !== pan.pid) return;
      const drag = Math.hypot(e.clientX - pan.x0, e.clientY - pan.y0);
      if (!pan.committed) {
        if (drag <= SLOP_PX) return;
        pan.committed = true;
        blockNextClick = true;
        surface.classList.add("map-quiz-surface--panning");
        try {
          surface.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      }
      const r = surface.getBoundingClientRect();
      const dux = -(e.clientX - pan.x0) * (pan.vbw0 / r.width);
      const duy = -(e.clientY - pan.y0) * (pan.vbh0 / r.height);
      state.vbx = pan.vbx0 + dux;
      state.vby = pan.vby0 + duy;
      state.vbw = pan.vbw0;
      state.vbh = pan.vbh0;
      clamp();
      apply();
    };
    const endPan = (e) => {
      if (!pan) return;
      if (e && e.pointerId != null && e.pointerId !== pan.pid) return;
      try {
        surface.releasePointerCapture(pan.pid);
      } catch {
        /* ignore */
      }
      const stillTap =
        e &&
        !pan.committed &&
        Math.hypot(e.clientX - pan.x0, e.clientY - pan.y0) <= SLOP_PX;
      if (stillTap) {
        blockNextClick = false;
      }
      pan = null;
      surface.classList.remove("map-quiz-surface--panning");
    };
    const onUp = (e) => {
      if (!pan) return;
      if (e.pointerId !== pan.pid) return;
      endPan(e);
    };
    const onCaptureClick = (e) => {
      if (!blockNextClick) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      blockNextClick = false;
    };
    const onLost = () => {
      if (pan) {
        endPan();
      }
    };

    surface.addEventListener("wheel", onWheel, { passive: false });
    surface.addEventListener("pointerdown", onDown);
    surface.addEventListener("pointermove", onMove);
    surface.addEventListener("pointerup", onUp);
    surface.addEventListener("pointercancel", onLost);
    surface.addEventListener("lostpointercapture", onLost);
    surface.addEventListener("click", onCaptureClick, true);

    const reset = () => {
      if (initialView && initialView.vbw > 0) {
        state.vbx = initialView.vbx;
        state.vby = initialView.vby;
        state.vbw = initialView.vbw;
        state.vbh = initialView.vbh;
      } else if (useLock) {
        state.vbx = lock.vbx;
        state.vby = lock.vby;
        state.vbw = lock.vbw;
        state.vbh = lock.vbh;
      } else {
        state.vbx = wx;
        state.vby = wy;
        state.vbw = worldW;
        state.vbh = worldH;
      }
      apply();
    };
    apply();
    mapViewNav = { reset };
  }

  function pulseSolidRedPaths(ps, onMs, offMs, cycles, onDone) {
    if (ps.length === 0) {
      onDone && onDone();
      return;
    }
    const PULSE = "map-pulse-red-solid";
    const max = cycles * 2;
    let step = 0;
    const tick = () => {
      if (step >= max) {
        ps.forEach((p) => p.classList.remove(PULSE));
        if (onDone) onDone();
        return;
      }
      const on = step % 2 === 0;
      ps.forEach((p) => p.classList.toggle(PULSE, on));
      step += 1;
      window.setTimeout(tick, on ? onMs : offMs);
    };
    tick();
  }

  function flashWrongId(id) {
    pulseSolidRedPaths(pathsForId(id), 135, 90, 3, undefined);
  }

  function finishRoundSuccess() {
    inputLocked = true;
    if (!currentTarget) return;
    const wrongBefore = wrongClicks;
    const ps = pathsForId(currentTarget.id);
    solvedIds.add(currentTarget.id);
    runSolvedTiers[Math.min(3, wrongBefore)] += 1;
    const mapComplete = solvedIds.size === countryList.length;
    score += 10 + Math.min(20, streak);
    streak += 1;
    if (streak > bestStreak) {
      bestStreak = streak;
      store.set(getBestStreakKey(), bestStreak);
    }
    updateHud();
    if ($("mapQuizStatus")) {
      const qual =
        wrongBefore === 0
          ? "Perfect"
          : wrongBefore === 1
            ? "1 wrong — saved"
            : wrongBefore === 2
              ? "2 wrong — saved"
              : "3 wrong — saved";
      $("mapQuizStatus").textContent = mapComplete
        ? `Correct! ${qual} — map complete!`
        : `Correct! ${qual}.`;
      $("mapQuizStatus").classList.add("ok");
      $("mapQuizStatus").classList.remove("bad");
    }
    const solvedClass = SOLVE_CLASS(wrongBefore);
    ps.forEach((p) => {
      clearPersistSolvedClass(p);
      p.classList.add(solvedClass);
    });
    round += 1;
    setTimeout(() => {
      if ($("mapQuizStatus")) {
        $("mapQuizStatus").textContent = "";
        $("mapQuizStatus").classList.remove("ok");
      }
      if (mapComplete) {
        showVictoryScreen();
      } else {
        nextQuestion();
        updateHud();
      }
    }, SUCCESS_NEXT_MS);
  }

  function finishRoundFail() {
    inputLocked = true;
    runReveals += 1;
    streak = 0;
    updateHud();
    if (!currentTarget) return;
    const ps = pathsForId(currentTarget.id);
    if ($("mapQuizStatus") && currentTarget) {
      $("mapQuizStatus").textContent = `The answer was ${currentTarget.name} — watch it flash, then it stays red.`;
      $("mapQuizStatus").classList.add("bad");
      $("mapQuizStatus").classList.remove("ok");
    }
    if ($("mapQuizTarget") && currentTarget) {
      $("mapQuizTarget").textContent = currentTarget.name;
    }
    updateGuessesLine();
    pulseSolidRedPaths(ps, 150, 100, 3, () => {
      ps.forEach((p) => {
        p.classList.add(PERSIST_REVEALED);
      });
      round += 1;
      setTimeout(() => {
        if ($("mapQuizStatus")) {
          $("mapQuizStatus").textContent = "";
          $("mapQuizStatus").classList.remove("bad");
        }
        nextQuestion();
        updateHud();
      }, 2400);
    });
  }

  function onRegionClick(id) {
    if (victoryVisible || !currentTarget || inputLocked) return;
    const clickedName = nameById.get(id) || "Unknown";
    if (id === currentTarget.id) {
      finishRoundSuccess();
      return;
    }

    wrongClicks += 1;
    flashWrongId(id);
    if ($("mapQuizStatus")) {
      const left = Math.max(0, MAX_WRONG - wrongClicks);
      $("mapQuizStatus").textContent =
        left > 0
          ? `${clickedName}. ${left} wrong ${left === 1 ? "guess" : "guesses"} left.`
          : "";
      $("mapQuizStatus").classList.remove("ok", "bad");
    }
    updateGuessesLine();

    if (wrongClicks >= MAX_WRONG) {
      finishRoundFail();
    }
  }

  /**
   * @param {SVGSVGElement} svg
   * @param {((id: string) => boolean) | null} isActive
   */
  function wireMap(svg, isActive) {
    const paths = svg.querySelectorAll("path");
    /** @type {Map<string, { id: string, name: string, elts: SVGPathElement[] }>} */
    const groups = new Map();

    paths.forEach((path) => {
      const key = countryKeyFromPath(path);
      if (!key) return;
      const name = countryNameFromPath(path);
      if (!groups.has(key)) {
        groups.set(key, { id: key, name, elts: [] });
      } else {
        const g = groups.get(key);
        if (g && (g.name === "Unknown" || g.name === key) && name !== "Unknown") {
          g.name = name;
        }
      }
      groups.get(key).elts.push(path);
    });

    let list = Array.from(groups.values());
    if (isActive) {
      list = list.filter((g) => isActive(g.id));
    }
    countryList = list.map((g) => ({ id: g.id, name: g.name }));
    nameById = new Map(countryList.map((c) => [c.id, c.name]));

    groups.forEach((g) => {
      const active = isActive == null || isActive(g.id);
      g.elts.forEach((path) => {
        path.setAttribute("data-id", g.id);
        if (!active) {
          path.classList.add("map-quiz-land--inactive");
          path.style.pointerEvents = "none";
          return;
        }
        path.classList.add("map-region");
        try {
          path.style.removeProperty("fill");
        } catch {
          /* ignore */
        }
        path.setAttribute("tabindex", "0");
        path.setAttribute("role", "button");
        path.setAttribute("aria-label", g.name);
        path.addEventListener("click", (e) => {
          e.stopPropagation();
          onRegionClick(g.id);
        });
        path.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onRegionClick(g.id);
          }
        });
      });
    });
  }

  function updateMapHeader(cfg) {
    const h = $("mapQuizHeaderTitle");
    if (h) {
      h.textContent = cfg.isUS
        ? `Map quiz — ${REGION_TITLES.us}`
        : `Map quiz — ${REGION_TITLES[cfg.region] || "World"}`;
    }
  }

  async function buildMap() {
    const wrap = $("mapQuizSvg");
    if (!wrap) return;
    const cfg = getMapConfig();
    if (cfg.mode === "capitals") {
      wrap.innerHTML = `<p class="map-quiz-status bad" style="padding:16px">Capitals mode is not available yet. Go back and choose <strong>Countries</strong>.</p>`;
      svgMapEl = null;
      countryList = [];
      nameById = new Map();
      return;
    }

    wrap.innerHTML = `<p class="muted" style="padding:16px;text-align:center">Loading map…</p>`;
    try {
      const text = await getSvgText();
      const doc = new DOMParser().parseFromString(text, "image/svg+xml");
      const srcSvg = doc.querySelector("svg");
      if (!srcSvg) throw new Error("no svg root");

      const svg = document.importNode(srcSvg, true);
      svg.setAttribute("class", cfg.isUS ? "map-quiz-canvas map-quiz-canvas--us" : "map-quiz-canvas");
      svg.setAttribute("role", "img");
      svg.setAttribute(
        "aria-label",
        cfg.isUS ? "U.S. map, click a state" : "World map, click a country",
      );
      const vb = srcSvg.getAttribute("viewBox") || srcSvg.getAttribute("viewbox");
      if (vb) svg.setAttribute("viewBox", vb);
      if (!svg.getAttribute("preserveAspectRatio")) {
        svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
      }
      let rw = 2000;
      let rh = 857;
      if (vb) {
        const p = vb.trim().split(/[\s,]+/).map(Number);
        if (p.length >= 4 && p[2] > 0 && p[3] > 0) {
          if (p.length === 4) {
            rw = p[2];
            rh = p[3];
          }
        }
      }
      const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      rect.setAttribute("x", "0");
      rect.setAttribute("y", "0");
      rect.setAttribute("width", String(rw));
      rect.setAttribute("height", String(rh));
      rect.setAttribute("fill", getCssMapColor("--map-ocean", "#1a7ae8"));
      rect.setAttribute("class", "map-ocean");
      rect.setAttribute("aria-hidden", "true");
      svg.insertBefore(rect, svg.firstChild);

      wrap.innerHTML = "";
      wrap.appendChild(svg);
      svgMapEl = svg;
      updateMapHeader(cfg);

      const region = cfg.region;
      /** @type {((id: string) => boolean) | null} */
      let filter = null;
      if (!cfg.isUS && region !== "world") {
        filter = (id) => continentForMapKey(id) === region;
      }
      if (cfg.isUS) {
        filter = null;
      }
      wireMap(svg, filter);

      const viewDef = REGION_VIEW[region] || REGION_VIEW.world;
      const isGlobalWorld = region === "world";
      const initialView = isGlobalWorld ? null : { ...viewDef };
      const lock = isGlobalWorld ? null : { ...viewDef };
      initMapViewNav(wrap, svg, rw, rh, initialView, lock);
    } catch {
      wrap.innerHTML = `<p class="map-quiz-status bad" style="padding:16px">Could not load the map. Ensure <code>world-map-data.js</code> and <code>us-map-data.js</code> load before <code>map-quiz.js</code> (see <code>index.html</code>), or use a local HTTP server. Regenerate: <code>node tools/embed-world-map.cjs</code> and <code>node tools/embed-us-map.cjs</code>.</p>`;
      svgMapEl = null;
      countryList = [];
      nameById = new Map();
    }
  }

  function skipQuestion() {
    if (victoryVisible || !currentTarget || inputLocked) return;
    streak = 0;
    if ($("mapQuizStatus")) {
      $("mapQuizStatus").textContent = "Skipped";
      $("mapQuizStatus").classList.remove("ok", "bad");
    }
    updateHud();
    round += 1;
    setTimeout(() => {
      nextQuestion();
      updateHud();
    }, 500);
  }

  function resetGame() {
    hideVictoryScreen();
    score = 0;
    streak = 0;
    round = 1;
    lastTargetId = null;
    solvedIds.clear();
    runSolvedTiers = [0, 0, 0, 0];
    runReveals = 0;
    runStartMs = Date.now();
    clearAllPersist();
    if (mapViewNav) {
      mapViewNav.reset();
    }
    updateHud();
    nextQuestion();
  }

  let controlsBound = false;
  function bindControlsOnce() {
    if (controlsBound) return;
    controlsBound = true;
    const newBtn = $("mapQuizNewBtn");
    if (newBtn) newBtn.addEventListener("click", resetGame);
    const skipBtn = $("mapQuizSkipBtn");
    if (skipBtn) skipBtn.addEventListener("click", skipQuestion);
    const again = $("mapQuizVictoryAgain");
    if (again) again.addEventListener("click", resetGame);
    const changeRg = $("mapQuizVictoryChangeRegion");
    if (changeRg) {
      changeRg.addEventListener("click", () => {
        hideVictoryScreen();
      });
    }
  }

  async function runMapWithCurrentSession() {
    hideVictoryScreen();
    await buildMap();
    if (!svgMapEl || countryList.length === 0) {
      if ($("mapQuizTarget")) $("mapQuizTarget").textContent = "—";
      if ($("mapQuizGuesses")) $("mapQuizGuesses").textContent = "";
      return;
    }
    bestStreak = store.get(getBestStreakKey(), 0);
    updateHud();
    resetGame();
  }

  async function init() {
    if (!$("mapQuizSvg")) return;
    bindControlsOnce();
    await runMapWithCurrentSession();
    window.__bicMapQuizEnter = runMapWithCurrentSession;
  }

  function bootMapSelectStats() {
    refreshMapSelectPreviews();
    window.__bicMapSelectRefresh = refreshMapSelectPreviews;
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
    document.addEventListener("DOMContentLoaded", bootMapSelectStats);
  } else {
    init();
    bootMapSelectStats();
  }
})();
