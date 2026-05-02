/* ============================================================
   Resistor color code decoder (3–6 bands).
   Columns = bands; edit in any order. Capsule resistor SVG.
   ============================================================ */
(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);

  const COLORS = [
    {
      id: "black",
      label: "Black",
      digit: 0,
      mult: 1,
      tol: null,
      tcr: 250,
      chipClass: "resistor-chip--black",
      textDark: false,
      svg: "#121212",
    },
    {
      id: "brown",
      label: "Brown",
      digit: 1,
      mult: 10,
      tol: 1,
      tcr: 100,
      chipClass: "resistor-chip--brown",
      textDark: true,
      svg: "#6d3f29",
    },
    {
      id: "red",
      label: "Red",
      digit: 2,
      mult: 100,
      tol: 2,
      tcr: 50,
      chipClass: "resistor-chip--red",
      textDark: false,
      svg: "#c41e1e",
    },
    {
      id: "orange",
      label: "Orange",
      digit: 3,
      mult: 1e3,
      tol: null,
      tcr: 15,
      chipClass: "resistor-chip--orange",
      textDark: true,
      svg: "#e07020",
    },
    {
      id: "yellow",
      label: "Yellow",
      digit: 4,
      mult: 1e4,
      tol: null,
      tcr: 25,
      chipClass: "resistor-chip--yellow",
      textDark: true,
      svg: "#e8cb2a",
    },
    {
      id: "green",
      label: "Green",
      digit: 5,
      mult: 1e5,
      tol: 0.5,
      tcr: null,
      chipClass: "resistor-chip--green",
      textDark: true,
      svg: "#2d7a46",
    },
    {
      id: "blue",
      label: "Blue",
      digit: 6,
      mult: 1e6,
      tol: 0.25,
      tcr: 10,
      chipClass: "resistor-chip--blue",
      textDark: false,
      svg: "#2a5aaf",
    },
    {
      id: "violet",
      label: "Violet",
      digit: 7,
      mult: 1e7,
      tol: 0.1,
      tcr: 5,
      chipClass: "resistor-chip--violet",
      textDark: false,
      svg: "#6b42a8",
    },
    {
      id: "grey",
      label: "Grey",
      digit: 8,
      mult: 1e8,
      tol: 0.05,
      tcr: null,
      chipClass: "resistor-chip--grey",
      textDark: true,
      svg: "#7a838c",
    },
    {
      id: "white",
      label: "White",
      digit: 9,
      mult: 1e9,
      tol: null,
      tcr: null,
      chipClass: "resistor-chip--white",
      textDark: true,
      svg: "#f5f5f5",
    },
    {
      id: "gold",
      label: "Gold",
      digit: null,
      mult: 0.1,
      tol: 5,
      tcr: null,
      chipClass: "resistor-chip--gold",
      textDark: true,
      svg: "#cfa83a",
    },
    {
      id: "silver",
      label: "Silver",
      digit: null,
      mult: 0.01,
      tol: 10,
      tcr: null,
      chipClass: "resistor-chip--silver",
      textDark: true,
      svg: "#b8bec4",
    },
  ];

  const NONE_TOLERANCE = { id: "none", tol: 20 };

  const byId = Object.fromEntries(COLORS.map((c) => [c.id, c]));

  const LABELS = {
    3: ["1", "2", "×"],
    4: ["1", "2", "×", "±"],
    5: ["1", "2", "3", "×", "±"],
    6: ["1", "2", "3", "×", "±", "T"],
  };

  /** Body capsule (pill) in viewBox coords — bands are clipped inside */
  const BODY = Object.freeze({
    x: 58,
    y: 34,
    w: 284,
    h: 52,
    rx: 26,
  });

  function bandCenters(bc) {
    const inset = BODY.rx + 18;
    const L = BODY.x + inset;
    const R = BODY.x + BODY.w - inset;
    if (bc <= 1) return [(L + R) / 2];
    return Array.from({ length: bc }, (_, i) => L + (i / (bc - 1)) * (R - L));
  }

  function bandHalfW(bc) {
    return bc <= 4 ? 10 : bc === 5 ? 8 : 7;
  }

  function multiplierIndex(bc) {
    return bc <= 4 ? 2 : 3;
  }

  function toleranceIndex(bc) {
    if (bc <= 3) return -1;
    if (bc <= 5) return bc - 1;
    return 4;
  }

  function tcrIndex(bc) {
    return bc === 6 ? 5 : -1;
  }

  function digitBandIndices(bc) {
    return bc <= 4 ? [0, 1] : [0, 1, 2];
  }

  /** @returns {boolean} */
  function slotAccepts(bc, idx, colorId) {
    const dBands = digitBandIndices(bc);
    const mi = multiplierIndex(bc);
    const ti = toleranceIndex(bc);
    const ci = tcrIndex(bc);

    if (colorId === NONE_TOLERANCE.id) return ti === idx;

    const c = byId[colorId];
    if (!c) return false;

    if (dBands.includes(idx)) return c.digit != null;
    if (idx === mi) return c.mult != null;
    if (idx === ti) return c.tol != null;
    if (idx === ci) return c.tcr != null && Number.isFinite(c.tcr);
    return false;
  }

  function formatResistance(ohms) {
    if (!(ohms > 0 && Number.isFinite(ohms))) return "—";
    const pref = [
      ["G", 1e9],
      ["M", 1e6],
      ["k", 1e3],
    ];
    for (const [sym, scale] of pref) {
      if (ohms >= scale) {
        const v = ohms / scale;
        const txt =
          v >= 100 ? `${Math.round(v)}` : v >= 10 ? `${+(Math.round(v * 10) / 10)}` : `${+v.toPrecision(3)}`;
        return `${txt} ${sym}Ω`;
      }
    }
    if (ohms >= 10) return `${Math.round(ohms)} Ω`;
    if (ohms >= 1) return `${+(Math.round(ohms * 100) / 100)} Ω`;
    return `${Number.parseFloat(ohms.toPrecision(4))} Ω`;
  }

  function tolLabel(pct) {
    if (!(typeof pct === "number" && Number.isFinite(pct))) return "";
    const s = pct >= 10 && Number.isInteger(pct) ? String(Math.round(pct)) : String(pct);
    return `±${s}%`;
  }

  function decode(bc, picksStrict) {
    if (picksStrict.length !== bc || picksStrict.some((p) => p == null)) return null;

    const multI = multiplierIndex(bc);
    const tolI = toleranceIndex(bc);

    const digits = digitBandIndices(bc).map((i) => byId[picksStrict[i]].digit);
    const mult = byId[picksStrict[multI]].mult;

    let ohms = 0;
    if (bc === 3 || bc === 4) {
      if (digits[0] === null || digits[1] === null || mult == null) return null;
      ohms = (digits[0] * 10 + digits[1]) * mult;
    } else {
      if (digits[0] === null || digits[1] === null || digits[2] === null || mult == null) return null;
      ohms = (digits[0] * 100 + digits[1] * 10 + digits[2]) * mult;
    }

    let tolPct = 20;
    if (bc !== 3) {
      const tolPick = picksStrict[tolI];
      tolPct =
        tolPick === NONE_TOLERANCE.id ? NONE_TOLERANCE.tol : byId[tolPick].tol ?? null;
      if (tolPct == null) return null;
    }

    let tcrPpm = null;
    const ti = tcrIndex(bc);
    if (ti >= 0) {
      const ppm = byId[picksStrict[ti]].tcr;
      if (!Number.isFinite(ppm)) return null;
      tcrPpm = ppm;
    }

    return { ohms, tolPct, tcrPpm };
  }

  /** --- bootstrap --- */

  const colsRoot = $("#resistorColumns");
  const visual = $("#resistorVisual");
  const hintEl = $("#resistorHint");
  const outEl = $("#resistorOut");
  const extraEl = $("#resistorExtra");
  const bandCountHost = $("#resistorBandCountBtns");
  const btnClear = $("#resistorClear");

  if (
    !colsRoot ||
    !visual ||
    !hintEl ||
    !outEl ||
    !extraEl ||
    !bandCountHost ||
    !btnClear
  )
    return;

  let bandCount = 4;
  /** @type {(string|null)[]} */
  let picks = Array(4).fill(null);

  function picksComplete() {
    return picks.length === bandCount && picks.every((p) => p != null);
  }

  function anyPick() {
    return picks.some((p) => p != null);
  }

  /** Options shown in one column — only colours valid there */
  function colorOptionsForColumn(bc, colIdx) {
    const ids = COLORS.filter((c) => slotAccepts(bc, colIdx, c.id)).map((c) => c.id);
    if (toleranceIndex(bc) === colIdx) ids.push(NONE_TOLERANCE.id);
    return ids;
  }

  function rebuildBandCountBtns() {
    bandCountHost.innerHTML = "";
    [3, 4, 5, 6].forEach((n) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "resistor-nc-btn" + (n === bandCount ? " resistor-nc-btn--active" : "");
      b.textContent = String(n);
      b.setAttribute("aria-pressed", n === bandCount ? "true" : "false");
      b.addEventListener("click", () => {
        bandCount = n;
        picks = Array(n).fill(null);
        rebuildBandCountBtns();
        renderColumns();
        renderGraphic();
        updateOutputAndHint();
      });
      bandCountHost.appendChild(b);
    });
  }

  function multLegend(m) {
    if (m == null) return "—";
    if (m >= 1e9) return `${m / 1e9} GΩ`;
    if (m >= 1e6) return `${m / 1e6} MΩ`;
    if (m >= 1e3) return `${m / 1e3} kΩ`;
    if (m < 1) return String(m);
    return `${m}`;
  }

  function chipTitleForColor(c) {
    if (!c) return "±20%";
    return c.digit != null
      ? `${c.label} ${c.digit} x${multLegend(c.mult)}`
      : `${c.label} x${multLegend(c.mult)}${c.tol != null ? " tol " + c.tol + "%" : ""}`;
  }

  function renderColumns() {
    colsRoot.innerHTML = "";
    colsRoot.style.setProperty("--rsv-band-count", String(bandCount));

    for (let i = 0; i < bandCount; i++) {
      const opts = colorOptionsForColumn(bandCount, i);
      const col = document.createElement("div");
      col.className = "resistor-column";

      const head = document.createElement("div");
      head.className = "resistor-col-head muted";
      head.textContent = LABELS[bandCount][i];
      head.setAttribute("aria-label", `Band ${i + 1}: ${LABELS[bandCount][i]}`);
      col.appendChild(head);

      const stack = document.createElement("div");
      stack.className = "resistor-col-stack";
      stack.setAttribute("role", "group");
      stack.setAttribute("aria-label", LABELS[bandCount][i]);

      opts.forEach((oid) => {
        const chip = document.createElement("button");
        chip.type = "button";
        if (oid === NONE_TOLERANCE.id) {
          chip.className = "resistor-chip resistor-chip--none resistor-chip--sm resistor-chip--text-dark";
          chip.dataset.colorId = NONE_TOLERANCE.id;
          chip.dataset.col = String(i);
          chip.innerHTML = `<span class="rsv-none-strong">±20%</span>`;
          chip.title = chipTitleForColor(null);
        } else {
          const c = byId[oid];
          chip.dataset.colorId = c.id;
          chip.dataset.col = String(i);
          chip.textContent = c.label;
          chip.title = chipTitleForColor(c);
          chip.className =
            `resistor-chip resistor-chip--sm ${c.chipClass} ` +
            (c.textDark ? "resistor-chip--text-dark" : "resistor-chip--text-light");
        }
        chip.setAttribute("aria-pressed", picks[i] === oid ? "true" : "false");
        chip.classList.toggle("resistor-chip--picked", picks[i] === oid);
        chip.addEventListener("click", () => {
          picks[i] = oid;
          renderColumns();
          renderGraphic();
          updateOutputAndHint();
        });
        stack.appendChild(chip);
      });

      col.appendChild(stack);
      colsRoot.appendChild(col);
    }
  }

  function bandRectSvg(bc, idx, cx) {
    const hw = bandHalfW(bc);
    const vp = 5;
    const y = BODY.y + vp;
    const bandH = BODY.h - vp * 2;
    const pick = picks[idx];
    if (pick == null) {
      return `<rect data-band="${idx}" x="${cx - hw}" y="${y}" width="${hw * 2}" height="${bandH}" rx="2.5" fill="rgba(255,255,255,0.1)"/>`;
    }
    if (pick === NONE_TOLERANCE.id) {
      return `<rect data-band="${idx}" x="${cx - hw}" y="${y}" width="${hw * 2}" height="${bandH}" rx="2.5" fill="rgba(255,252,245,0.28)" stroke="rgba(0,0,0,0.09)" stroke-width="0.9" stroke-dasharray="3 5"/>`;
    }
    const fill = byId[pick]?.svg ?? "#444";
    return `<rect data-band="${idx}" x="${cx - hw}" y="${y}" width="${hw * 2}" height="${bandH}" rx="2.5" fill="${fill}" stroke="rgba(0,0,0,0.1)" stroke-width="1"/>`;
  }

  function renderGraphic() {
    const centers = bandCenters(bandCount);
    const rects = [];
    for (let i = 0; i < bandCount; i++) {
      rects.push(bandRectSvg(bandCount, i, centers[i]));
    }

    const { x, y, w, h, rx } = BODY;

    visual.innerHTML = `
      <svg class="resistor-svg" viewBox="0 0 400 118" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="rsv-svg-title">
        <title id="rsv-svg-title">${bandCount}-band resistor</title>
        <defs>
          <clipPath id="bicRsvBandsClip">
            <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" ry="${rx}" />
          </clipPath>
        </defs>
        <g class="resv-flat" stroke-linejoin="round">
          <path class="rsv-lead rsv-lead--l" fill="none" stroke="#969DA5" stroke-width="11" stroke-linecap="round" d="M 32 109 L32 60 L56 60" />
          <path class="rsv-lead rsv-lead--r" fill="none" stroke="#969DA5" stroke-width="11" stroke-linecap="round" d="M 344 60 L368 60 L368 109" />
          <rect class="rsv-body-fill" x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" ry="${rx}" fill="#EAD1BB" stroke="none"/>
          <g class="rsv-bands" clip-path="url(#bicRsvBandsClip)">${rects.join("")}</g>
          <rect class="rsv-body-stroke" x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" ry="${rx}" fill="none" stroke="#BFAB8E" stroke-width="1.5"/>
        </g>
      </svg>`;
  }

  function updateOutputAndHint() {
    btnClear.disabled = !anyPick();

    hintEl.textContent = "";

    if (!picksComplete()) {
      outEl.innerHTML = "&nbsp;";
      extraEl.textContent = "";
      return;
    }

    const strict = picks.slice();
    const r = decode(bandCount, strict);
    if (!r) {
      hintEl.textContent = "Can't decode.";
      outEl.innerHTML = "—";
      extraEl.textContent = "";
      return;
    }

    outEl.innerHTML =
      `<strong class="resistor-num">${formatResistance(r.ohms)}</strong> · ` +
      `<span class="resistor-tol">${tolLabel(r.tolPct)}</span>`;

    if (r.tcrPpm != null) {
      extraEl.textContent = `≈${r.tcrPpm} ppm`;
    } else extraEl.textContent = "";
  }

  btnClear.addEventListener("click", () => {
    picks = picks.map(() => null);
    renderColumns();
    renderGraphic();
    updateOutputAndHint();
  });

  rebuildBandCountBtns();
  picks = Array(bandCount).fill(null);
  renderGraphic();
  renderColumns();
  updateOutputAndHint();
})();
