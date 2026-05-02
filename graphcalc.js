/* ============================================================
   Graphing calculator — safe recursive-descent parser + canvas plot
   ============================================================ */
(() => {
  "use strict";

  function tokenize(str) {
    const t = [];
    let i = 0;
    const s = String(str || "").trim();
    while (i < s.length) {
      const c = s[i];
      if (/\s/.test(c)) {
        i++;
        continue;
      }
      if (/[0-9.]/.test(c)) {
        let j = i + 1;
        while (j < s.length && /[0-9.]/.test(s[j])) j++;
        const slice = s.slice(i, j);
        const num = parseFloat(slice);
        if (Number.isNaN(num)) throw new Error(`Invalid number near "${slice}"`);
        t.push({ type: "NUM", val: num });
        i = j;
        continue;
      }
      if (/[a-zA-Z]/.test(c)) {
        let j = i + 1;
        while (j < s.length && /[a-zA-Z0-9]/.test(s[j])) j++;
        t.push({ type: "IDENT", val: s.slice(i, j) });
        i = j;
        continue;
      }
      if ("+-*/^".includes(c)) {
        t.push({ type: "OP", val: c });
        i++;
        continue;
      }
      if (c === "(") {
        t.push({ type: "LPAREN" });
        i++;
        continue;
      }
      if (c === ")") {
        t.push({ type: "RPAREN" });
        i++;
        continue;
      }
      throw new Error(`Unexpected character “${c}”`);
    }
    t.push({ type: "EOF" });
    return t;
  }

  class Parser {
    constructor(tokens) {
      this.t = tokens;
      this.i = 0;
    }
    peek() {
      return this.t[this.i];
    }
    eof() {
      return this.peek().type === "EOF";
    }
    parseExpr() {
      return this.parseAddSub();
    }
    parseAddSub() {
      let left = this.parseMulDiv();
      while (!this.eof()) {
        const op = this.peek();
        if (op.type === "OP" && (op.val === "+" || op.val === "-")) {
          this.i++;
          const right = this.parseMulDiv();
          left = { type: "bin", op: op.val, left, right };
        } else break;
      }
      return left;
    }
    parseMulDiv() {
      let left = this.parsePow();
      while (!this.eof()) {
        const op = this.peek();
        if (op.type === "OP" && (op.val === "*" || op.val === "/")) {
          this.i++;
          const right = this.parsePow();
          left = { type: "bin", op: op.val, left, right };
        } else break;
      }
      return left;
    }
    parsePow() {
      let left = this.parseUnary();
      const op = this.peek();
      if (op.type === "OP" && op.val === "^") {
        this.i++;
        const right = this.parsePow();
        return { type: "bin", op: "^", left, right };
      }
      return left;
    }
    parseUnary() {
      const op = this.peek();
      if (op.type === "OP" && (op.val === "+" || op.val === "-")) {
        this.i++;
        const arg = this.parseUnary();
        return op.val === "+" ? arg : { type: "unary", op: "-", arg };
      }
      return this.parsePrimary();
    }
    parsePrimary() {
      const tok = this.peek();
      if (tok.type === "NUM") {
        this.i++;
        return { type: "num", val: tok.val };
      }
      if (tok.type === "IDENT") {
        const raw = tok.val;
        const id = raw.toLowerCase();
        this.i++;
        const next = this.peek();
        if (next.type === "LPAREN") {
          this.i++;
          const inner = this.parseExpr();
          const close = this.peek();
          if (close.type !== "RPAREN") throw new Error('Expected “)”');
          this.i++;
          return this.funcCall(id, inner);
        }
        if (id === "x") return { type: "var", name: "x" };
        if (id === "y") return { type: "var", name: "y" };
        if (id === "pi") return { type: "const", val: Math.PI };
        if (id === "e") return { type: "const", val: Math.E };
        throw new Error(`Unknown identifier “${raw}”`);
      }
      if (tok.type === "LPAREN") {
        this.i++;
        const inner = this.parseExpr();
        if (this.peek().type !== "RPAREN") throw new Error('Expected “)”');
        this.i++;
        return inner;
      }
      throw new Error("Expected number, identifier, or “(”");
    }
    funcCall(name, arg) {
      const allowed = ["sin", "cos", "tan", "sqrt", "abs", "ln", "log"];
      if (!allowed.includes(name)) throw new Error(`Unknown function “${name}(…)”`);
      return { type: "call", name, arg };
    }
    parseTop() {
      const ast = this.parseExpr();
      if (!this.eof()) throw new Error("Extra input after expression");
      return ast;
    }
  }

  function evalAst(node, env) {
    switch (node.type) {
      case "num":
        return node.val;
      case "var":
        return node.name === "x" ? env.x : env.y;
      case "const":
        return node.val;
      case "unary":
        return -evalAst(node.arg, env);
      case "bin": {
        const a = evalAst(node.left, env);
        const b = evalAst(node.right, env);
        switch (node.op) {
          case "+":
            return a + b;
          case "-":
            return a - b;
          case "*":
            return a * b;
          case "/":
            return a / b;
          case "^":
            return Math.pow(a, b);
          default:
            return NaN;
        }
      }
      case "call": {
        const v = evalAst(node.arg, env);
        switch (node.name) {
          case "sin":
            return Math.sin(v);
          case "cos":
            return Math.cos(v);
          case "tan":
            return Math.tan(v);
          case "sqrt":
            return Math.sqrt(v);
          case "abs":
            return Math.abs(v);
          case "ln":
            return Math.log(v);
          case "log":
            return typeof Math.log10 === "function" ? Math.log10(v) : Math.log(v) / Math.LN10;
          default:
            return NaN;
        }
      }
      default:
        return NaN;
    }
  }

  /** Insert implicit × between tokens (e.g. 2x → 2*x, )( → )*( , x( → x*( ). */
  function tokensImplicitMultiply(tokens) {
    const FUNCS = new Set(["sin", "cos", "tan", "sqrt", "abs", "ln", "log"]);
    const CONST = new Set(["pi", "e"]);
    const out = [];
    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i];
      if (tok.type === "EOF") {
        out.push(tok);
        break;
      }
      out.push(tok);
      const next = tokens[i + 1];
      if (!next || next.type === "EOF") continue;
      let insert = false;
      if (tok.type === "NUM") {
        insert = next.type === "IDENT" || next.type === "LPAREN";
      } else if (tok.type === "RPAREN") {
        insert = next.type === "LPAREN" || next.type === "IDENT";
      } else if (tok.type === "IDENT") {
        const id = tok.val.toLowerCase();
        if (next.type === "LPAREN") insert = !FUNCS.has(id) && !CONST.has(id);
      }
      if (insert) out.push({ type: "OP", val: "*" });
    }
    return out;
  }

  /** Optional leading `y=` (y vs x) or `x=` (x vs y). Otherwise treated as y vs x. */
  function parseEquationPrefix(raw) {
    const t = String(raw || "").trim();
    if (/^\s*y\s*=/i.test(t)) return { kind: "yx", expr: t.replace(/^\s*y\s*=\s*/i, "").trim() };
    if (/^\s*x\s*=/i.test(t)) return { kind: "xy", expr: t.replace(/^\s*x\s*=\s*/i, "").trim() };
    return { kind: "yx", expr: t };
  }

  /**
   * @returns {{ kind: 'yx', fn: (x:number)=>number } | { kind: 'xy', fn: (y:number)=>number }}
   */
  function compileExpr(raw) {
    const { kind, expr } = parseEquationPrefix(raw);
    const tokens = tokensImplicitMultiply(tokenize(expr));
    const p = new Parser(tokens);
    const ast = p.parseTop();
    if (kind === "yx") {
      const fn = (xv) => evalAst(ast, { x: xv, y: NaN });
      return { kind: "yx", fn };
    }
    const fn = (yv) => evalAst(ast, { x: NaN, y: yv });
    return { kind: "xy", fn };
  }

  function parseFloatSafe(el, fallback) {
    const v = parseFloat(String(el.value || "").trim().replace(/\u2212/g, "-"));
    return Number.isFinite(v) ? v : fallback;
  }

  /** Plot stroke / sidebar dot colors in order: blue, red, green, purple, orange, yellow */
  const GRAPH_COLORS = ["#2563eb", "#dc2626", "#16a34a", "#9333ea", "#ea580c", "#ca8a04"];

  function GraphCalc() {
    const panel = document.getElementById("panel-graphcalc");
    const canvas = document.getElementById("graphcalcCanvas");
    if (!panel || !canvas) return;

    const exprEls = [];
    for (let i = 0; i < 6; i++) {
      exprEls.push(document.getElementById(`graphcalcExpr${i}`));
    }
    GRAPH_COLORS.forEach((c, i) => {
      const dot = document.querySelector(`[data-graphcalc-line="${i}"]`);
      if (dot) dot.style.background = c;
    });

    const xMinEl = document.getElementById("graphcalcXMin");
    const xMaxEl = document.getElementById("graphcalcXMax");
    const yMinEl = document.getElementById("graphcalcYMin");
    const yMaxEl = document.getElementById("graphcalcYMax");
    const autoYEl = document.getElementById("graphcalcAutoY");
    const errEl = document.getElementById("graphcalcErr");
    const plotBtn = document.getElementById("graphcalcPlotBtn");
    const fitBtn = document.getElementById("graphcalcFitBtn");
    const zoomInBtn = document.getElementById("graphcalcZoomInBtn");
    const zoomOutBtn = document.getElementById("graphcalcZoomOutBtn");

    const ctx = canvas.getContext("2d");
    let compiled = [null, null, null, null, null, null];
    let lastCompileErr = "";
    let drag = null;

    const gameModeSwitch = document.getElementById("graphcalcGameModeSwitch");
    const graphcalcPlayDock = document.getElementById("graphcalcPlayDock");
    const graphcalcPlayBtn = document.getElementById("graphcalcPlayBtn");
    const graphcalcGameStatus = document.getElementById("graphcalcGameStatus");

    let gameMode = false;
    let simRunning = false;
    let gameRaf = 0;
    let lastPhysicsTs = 0;
    let gameOutcome = null;
    /** False after win or miss until next Play — ball not drawn. */
    let ballVisible = true;
    /** Current puzzle index (shown after wins / game mode on). */
    let gameLevel = 1;
    /** World-axis-aligned blocker rects { left, right, bottom, top }; optional each round. */
    let barriers = [];

    const ball = { x: 0, y: 0, vx: 0, vy: 0, r: 0.3 };
    const ballStart = { x: 0, y: 0 };
    const cup = { cx: 0, rimY: 0, innerW: 0, floorY: 0 };

    const PHYS_GRAVITY = 48;
    const PHYS_BOUNCE = 0.42;
    const PHYS_FRIC = 0.91;
    /** Rolling friction along tangent (applied while on curve). */
    const PHYS_ROLL_FRIC = 0.988;

    function getWorldBounds() {
      return {
        xmin: parseFloatSafe(xMinEl, -10),
        xmax: parseFloatSafe(xMaxEl, 10),
        ymin: parseFloatSafe(yMinEl, -10),
        ymax: parseFloatSafe(yMaxEl, 10),
      };
    }

    /** Cup + spawn — randomized values each level. */
    function layoutCupAndSpawn(xmin, xmax, ymin, ymax) {
      const sx = xmax - xmin;
      const sy = ymax - ymin;
      ball.r = Math.max(sy * 0.02, sx * 0.009, 1e-4);
      cup.innerW = sx * (0.085 + Math.random() * 0.048);
      cup.cx = xmin + sx * (0.46 + Math.random() * 0.48);
      cup.rimY = ymin + sy * (0.058 + Math.random() * 0.065);
      cup.floorY = ymin + sy * (0.016 + Math.random() * 0.038);
      if (cup.rimY < cup.floorY + sy * 0.028) cup.rimY = cup.floorY + sy * 0.04;
      ballStart.x = xmin + sx * (0.055 + Math.random() * 0.22);
      ballStart.y = ymax - sy * (0.075 + Math.random() * 0.13);
      resetBallToSpawn();
    }

    /** Sometimes 1–2 barriers; often none. Avoids overlapping the cup opening in x. */
    function randomizeBarriers(xmin, xmax, ymin, ymax) {
      barriers.length = 0;
      const sx = xmax - xmin;
      const sy = ymax - ymin;
      const rimHalf = cup.innerW * 0.5;
      const cupXL = cup.cx - rimHalf - sx * 0.035;
      const cupXR = cup.cx + rimHalf + sx * 0.035;

      const roll = Math.random();
      const count = roll < 0.45 ? 0 : roll < 0.82 ? 1 : 2;

      for (let i = 0; i < count; i++) {
        for (let tries = 0; tries < 28; tries++) {
          const bw = sx * (0.014 + Math.random() * 0.032);
          const bx = xmin + sx * (0.16 + Math.random() * 0.68);
          const bh = sy * (0.05 + Math.random() * 0.2);
          const yMid = ymin + sy * (0.12 + Math.random() * 0.48);
          const left = bx - bw / 2;
          const right = bx + bw / 2;
          if (right > cupXL && left < cupXR) continue;
          barriers.push({
            left,
            right,
            bottom: yMid - bh / 2,
            top: yMid + bh / 2,
          });
          break;
        }
      }
    }

    function randomizeLevel(xmin, xmax, ymin, ymax) {
      layoutCupAndSpawn(xmin, xmax, ymin, ymax);
      randomizeBarriers(xmin, xmax, ymin, ymax);
    }

    function resetBallToSpawn() {
      ball.x = ballStart.x;
      ball.y = ballStart.y;
      ball.vx = 0;
      ball.vy = 0;
    }

    function setSimCanvasStyle(on) {
      canvas.classList.toggle("graphcalc-sim-active", !!on);
    }

    function supportYAt(wx, ymin) {
      let sup = ymin;
      for (let fi = 0; fi < compiled.length; fi++) {
        const row = compiled[fi];
        if (!row || row.kind !== "yx") continue;
        const fh = row.fn(wx);
        if (Number.isFinite(fh)) sup = Math.max(sup, fh);
      }
      return sup;
    }

    /** df/dx for upper envelope y = max_i f_i(x), finite difference on combined support. */
    function derivativeSupport(wx, ymin, xmin, xmax) {
      const span = xmax - xmin;
      const h = Math.max(Math.abs(span) * 1e-7, 1e-10);
      return (supportYAt(wx + h, ymin) - supportYAt(wx - h, ymin)) / (2 * h);
    }

    function tangentBasis(wx, ymin, xmin, xmax) {
      const fp = derivativeSupport(wx, ymin, xmin, xmax);
      const len = Math.sqrt(1 + fp * fp);
      const tx = 1 / len;
      const ty = fp / len;
      const nx = -fp / len;
      const ny = 1 / len;
      return { fp, tx, ty, nx, ny };
    }

    /** Trapezoid matches drawGameOverlay: rim width innerW, floor width 0.84× half (~0.42× innerW full half). */
    function resolveCupGame(xmin, xmax, ymin, ymax) {
      if (gameOutcome !== null) return;
      const spanY = ymax - ymin;
      const spanX = xmax - xmin;
      const bottom = ball.y - ball.r;
      const rimHalf = cup.innerW * 0.5;
      const floorHalf = cup.innerW * 0.42;
      const depth = cup.rimY - cup.floorY;

      function halfWidthAtBottom(botY) {
        if (depth <= 1e-12) return rimHalf;
        const t = Math.max(0, Math.min(1, (botY - cup.floorY) / depth));
        return floorHalf + t * (rimHalf - floorHalf);
      }

      const hw = Math.max(halfWidthAtBottom(bottom) - ball.r * 0.4, ball.r * 0.15);
      const inCupHoriz = Math.abs(ball.x - cup.cx) <= hw;

      const inCupVert =
        bottom >= cup.floorY - ball.r * 0.35 &&
        bottom <= cup.rimY + ball.r * 0.65 &&
        ball.y <= cup.rimY + ball.r * 1.35;

      const speed = Math.hypot(ball.vx, ball.vy);
      const slowEnough = speed < Math.max(spanY, spanX) * 0.72;

      if (inCupHoriz && inCupVert && slowEnough) {
        gameOutcome = "win";
        ballVisible = false;
        simRunning = false;
        setSimCanvasStyle(false);
        gameLevel += 1;
        randomizeLevel(xmin, xmax, ymin, ymax);
        const bh =
          barriers.length === 0 ? "" : ` · ${barriers.length} barrier${barriers.length > 1 ? "s" : ""}`;
        if (graphcalcGameStatus) {
          graphcalcGameStatus.textContent = `You got it in! Puzzle ${gameLevel}${bh} — tap Play.`;
        }
        return;
      }

      const overlapsCupMiss = Math.abs(ball.x - cup.cx) < rimHalf + ball.r * 1.6;
      const floorMissGap = Math.max(spanY * 0.015, ball.r * 0.22);
      const belowCupFloor = bottom < cup.floorY - floorMissGap;
      if (overlapsCupMiss && belowCupFloor) {
        ballVisible = false;
        resetBallToSpawn();
        simRunning = false;
        setSimCanvasStyle(false);
        if (graphcalcGameStatus) graphcalcGameStatus.textContent = "Miss — tap Play.";
      }
    }

    function resolveBarrierHits(xmin, xmax, ymin, ymax) {
      if (!barriers.length) return;
      const eps = Math.max((ymax - ymin) * 1e-7, ball.r * 1e-5);

      for (let i = 0; i < barriers.length; i++) {
        const b = barriers[i];
        const L = b.left;
        const R = b.right;
        const Bot = b.bottom;
        const Top = b.top;

        const cx = ball.x;
        const cy = ball.y;
        const r = ball.r;

        const qx = Math.max(L, Math.min(cx, R));
        const qy = Math.max(Bot, Math.min(cy, Top));
        let dx = cx - qx;
        let dy = cy - qy;
        let distSq = dx * dx + dy * dy;

        if (distSq >= r * r - 1e-20) continue;

        if (distSq < 1e-22) {
          const penL = cx - L;
          const penR = R - cx;
          const penB = cy - Bot;
          const penT = Top - cy;
          const m = Math.min(penL, penR, penB, penT);
          if (m === penL) {
            ball.x = L - r - eps;
            ball.vx *= -0.55;
          } else if (m === penR) {
            ball.x = R + r + eps;
            ball.vx *= -0.55;
          } else if (m === penB) {
            ball.y = Bot - r - eps;
            ball.vy *= -0.55;
          } else {
            ball.y = Top + r + eps;
            ball.vy *= -0.55;
          }
          continue;
        }

        const dist = Math.sqrt(distSq);
        const nx = dx / dist;
        const ny = dy / dist;
        const overlap = r - dist + eps;
        ball.x += nx * overlap;
        ball.y += ny * overlap;
        const vn = ball.vx * nx + ball.vy * ny;
        if (vn < 0) {
          ball.vx -= 2 * vn * nx;
          ball.vy -= 2 * vn * ny;
          ball.vx *= 0.78;
          ball.vy *= 0.78;
        }
      }
    }

    function physicsStep(dt, xmin, xmax, ymin, ymax) {
      const spanY = ymax - ymin;
      const contactTol = Math.max(spanY * 4e-5, ball.r * 0.055);
      const impactTol = spanY * 0.018;

      let sup = supportYAt(ball.x, ymin);
      let bottom = ball.y - ball.r;
      let tb = tangentBasis(ball.x, ymin, xmin, xmax);

      const onRamp = bottom <= sup + contactTol;

      if (onRamp) {
        const atScalar = -PHYS_GRAVITY * tb.ty;
        ball.vx += atScalar * tb.tx * dt;
        ball.vy += atScalar * tb.ty * dt;

        let vt = ball.vx * tb.tx + ball.vy * tb.ty;
        vt *= Math.pow(PHYS_ROLL_FRIC, dt * 60);
        let vn = ball.vx * tb.nx + ball.vy * tb.ny;
        if (vn < 0) {
          if (vn < -impactTol) vn *= -PHYS_BOUNCE;
          else vn = 0;
        }
        ball.vx = vt * tb.tx + vn * tb.nx;
        ball.vy = vt * tb.ty + vn * tb.ny;

        ball.x += ball.vx * dt;
        ball.y += ball.vy * dt;

        sup = supportYAt(ball.x, ymin);
        tb = tangentBasis(ball.x, ymin, xmin, xmax);
        ball.y = sup + ball.r;

        let vn2 = ball.vx * tb.nx + ball.vy * tb.ny;
        if (vn2 < 0) {
          ball.vx -= vn2 * tb.nx;
          ball.vy -= vn2 * tb.ny;
        }
        const vt3 = ball.vx * tb.tx + ball.vy * tb.ty;
        ball.vx = vt3 * tb.tx;
        ball.vy = vt3 * tb.ty;

        if (ball.x - ball.r < xmin) {
          ball.x = xmin + ball.r;
          ball.vx *= -0.45;
        } else if (ball.x + ball.r > xmax) {
          ball.x = xmax - ball.r;
          ball.vx *= -0.45;
        }
      } else {
        ball.vy -= PHYS_GRAVITY * dt;
        ball.vx *= Math.pow(0.998, dt * 60);

        ball.x += ball.vx * dt;
        ball.y += ball.vy * dt;

        if (ball.x - ball.r < xmin) {
          ball.x = xmin + ball.r;
          ball.vx *= -0.45;
        } else if (ball.x + ball.r > xmax) {
          ball.x = xmax - ball.r;
          ball.vx *= -0.45;
        }

        sup = supportYAt(ball.x, ymin);
        bottom = ball.y - ball.r;
        if (bottom < sup && ball.vy <= 0) {
          ball.y = sup + ball.r;
          ball.vy = -ball.vy * PHYS_BOUNCE;
          ball.vx *= PHYS_FRIC;
          if (Math.abs(ball.vy) < spanY * 0.002) ball.vy = 0;
          tb = tangentBasis(ball.x, ymin, xmin, xmax);
          const vt = ball.vx * tb.tx + ball.vy * tb.ty;
          ball.vx = vt * tb.tx;
          ball.vy = vt * tb.ty;
        }
      }

      resolveBarrierHits(xmin, xmax, ymin, ymax);
      resolveCupGame(xmin, xmax, ymin, ymax);
    }

    function gameLoop() {
      if (!simRunning || !gameMode) return;
      const b = getWorldBounds();
      if (!(b.xmax > b.xmin && b.ymax > b.ymin)) {
        stopSimulation();
        draw();
        return;
      }
      const now = performance.now();
      let dt = (now - lastPhysicsTs) / 1000;
      if (!Number.isFinite(dt) || dt <= 0) dt = 1 / 60;
      dt = Math.min(1 / 30, Math.max(1 / 480, dt));
      lastPhysicsTs = now;
      const subs = 4;
      for (let s = 0; s < subs; s++) physicsStep(dt / subs, b.xmin, b.xmax, b.ymin, b.ymax);
      draw(true);
      if (!simRunning) {
        gameRaf = 0;
        return;
      }
      gameRaf = requestAnimationFrame(gameLoop);
    }

    function stopSimulation() {
      simRunning = false;
      setSimCanvasStyle(false);
      if (gameRaf) cancelAnimationFrame(gameRaf);
      gameRaf = 0;
    }

    function cssColor(prop, fallback) {
      try {
        const v = getComputedStyle(document.documentElement).getPropertyValue(prop).trim();
        return v || fallback;
      } catch {
        return fallback;
      }
    }

    const stage = canvas.closest(".graphcalc-stage-wrap");

    function drawGameOverlay(xmin, xmax, ymin, ymax, cw, ch) {
      for (let i = 0; i < barriers.length; i++) {
        const br = barriers[i];
        const p1 = pixelFromWorld(br.left, br.top, xmin, xmax, ymin, ymax, cw, ch);
        const p2 = pixelFromWorld(br.right, br.bottom, xmin, xmax, ymin, ymax, cw, ch);
        const px = Math.min(p1.px, p2.px);
        const py = Math.min(p1.py, p2.py);
        const pw = Math.abs(p2.px - p1.px);
        const ph = Math.abs(p2.py - p1.py);
        ctx.save();
        ctx.fillStyle = "rgba(72, 62, 52, 0.94)";
        ctx.strokeStyle = "rgba(34, 26, 18, 0.95)";
        ctx.lineWidth = 1.5;
        ctx.fillRect(px, py, pw, ph);
        ctx.strokeRect(px + 0.5, py + 0.5, pw - 1, ph - 1);
        ctx.restore();
      }

      const rimPx = pixelFromWorld(cup.cx - cup.innerW / 2, cup.rimY, xmin, xmax, ymin, ymax, cw, ch);
      const rimPxR = pixelFromWorld(cup.cx + cup.innerW / 2, cup.rimY, xmin, xmax, ymin, ymax, cw, ch);
      const inner = cup.innerW * 0.42;
      const botL = pixelFromWorld(cup.cx - inner, cup.floorY, xmin, xmax, ymin, ymax, cw, ch);
      const botR = pixelFromWorld(cup.cx + inner, cup.floorY, xmin, xmax, ymin, ymax, cw, ch);

      ctx.save();
      ctx.fillStyle = "#ea580c";
      ctx.strokeStyle = "#9a3412";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(rimPx.px, rimPx.py);
      ctx.lineTo(rimPxR.px, rimPxR.py);
      ctx.lineTo(botR.px, botR.py);
      ctx.lineTo(botL.px, botL.py);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      if (!ballVisible) return;

      const bp = pixelFromWorld(ball.x, ball.y, xmin, xmax, ymin, ymax, cw, ch);
      const rPx = Math.max(3, (ball.r / (ymax - ymin)) * ch);
      ctx.save();
      ctx.beginPath();
      ctx.arc(bp.px, bp.py, rPx, 0, Math.PI * 2);
      const g = ctx.createRadialGradient(bp.px - rPx * 0.3, bp.py - rPx * 0.35, rPx * 0.2, bp.px, bp.py, rPx);
      g.addColorStop(0, "#fef08a");
      g.addColorStop(0.55, "#eab308");
      g.addColorStop(1, "#b45309");
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = "#78350f";
      ctx.lineWidth = 1.25;
      ctx.stroke();
      ctx.restore();
    }

    function resizeCanvas() {
      if (!stage) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const rect = stage.getBoundingClientRect();
      const w = Math.max(160, Math.floor(rect.width));
      const h = Math.max(160, Math.floor(rect.height));
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw(!!(simRunning || gameMode));
    }

    if (stage && typeof ResizeObserver !== "undefined") {
      new ResizeObserver(() => resizeCanvas()).observe(stage);
    }

    function worldFromPixel(px, py, xmin, xmax, ymin, ymax, cw, ch) {
      const x = xmin + (px / cw) * (xmax - xmin);
      const y = ymax - (py / ch) * (ymax - ymin);
      return { x, y };
    }

    function pixelFromWorld(wx, wy, xmin, xmax, ymin, ymax, cw, ch) {
      const px = ((wx - xmin) / (xmax - xmin)) * cw;
      const py = ((ymax - wy) / (ymax - ymin)) * ch;
      return { px, py };
    }

    function linTicks(lo, hi, maxTicks) {
      if (!(hi > lo) || maxTicks < 2) return [lo];
      const span = hi - lo;
      let raw = span / maxTicks;
      const pow10 = Math.pow(10, Math.floor(Math.log10(raw)));
      const n = raw / pow10;
      let nice = pow10;
      if (n <= 1) nice = pow10;
      else if (n <= 2) nice = 2 * pow10;
      else if (n <= 5) nice = 5 * pow10;
      else nice = 10 * pow10;
      const ticks = [];
      const start = Math.ceil(lo / nice) * nice;
      for (let t = start; t <= hi + nice * 1e-9; t += nice) ticks.push(t);
      return ticks;
    }

    function logicalCanvasSize() {
      const tf = ctx.getTransform();
      const sx = Math.abs(tf.a) || 1;
      const sy = Math.abs(tf.d) || 1;
      return {
        cw: canvas.width / sx,
        ch: canvas.height / sy,
      };
    }

    /** skipAutoY: don't rewrite y min/max from curves (Play button / physics frames keep your window stable). */
    function draw(skipAutoY) {
      const xmin = parseFloatSafe(xMinEl, -10);
      const xmax = parseFloatSafe(xMaxEl, 10);
      let ymin = parseFloatSafe(yMinEl, -10);
      let ymax = parseFloatSafe(yMaxEl, 10);
      const { cw, ch } = logicalCanvasSize();

      const bg = cssColor("--panel", "#161922");
      const grid = cssColor("--border", "#333");
      const axis = cssColor("--muted", "#888");

      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, cw, ch);

      if (!(xmax > xmin)) {
        errEl.textContent =
          "Window: x max must be greater than x min." +
          (lastCompileErr ? ` · ${lastCompileErr}` : "");
        return;
      }

      const samples = Math.min(8000, Math.floor(cw * 4));
      const activeFns = compiled.filter(Boolean);

      const allowAutoY =
        !skipAutoY && !simRunning && autoYEl.checked && activeFns.length > 0;

      if (allowAutoY) {
        let lo = Infinity;
        let hi = -Infinity;
        for (let i = 0; i <= samples; i++) {
          const x = xmin + ((xmax - xmin) * i) / samples;
          for (let fi = 0; fi < compiled.length; fi++) {
            const row = compiled[fi];
            if (!row || row.kind !== "yx") continue;
            const y = row.fn(x);
            if (!Number.isFinite(y)) continue;
            if (y < lo) lo = y;
            if (y > hi) hi = y;
          }
        }
        if (lo !== Infinity && hi > lo) {
          const pad = (hi - lo) * 0.08 + 1e-6;
          ymin = lo - pad;
          ymax = hi + pad;
          yMinEl.value = String(Math.round(ymin * 1000) / 1000);
          yMaxEl.value = String(Math.round(ymax * 1000) / 1000);
        }
      }

      if (!(ymax > ymin)) {
        errEl.textContent =
          "Window: y max must be greater than y min." +
          (lastCompileErr ? ` · ${lastCompileErr}` : "");
        return;
      }

      ctx.strokeStyle = grid;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.65;

      linTicks(xmin, xmax, 12).forEach((wx) => {
        const { px } = pixelFromWorld(wx, 0, xmin, xmax, ymin, ymax, cw, ch);
        if (px < 0 || px > cw) return;
        ctx.beginPath();
        ctx.moveTo(px, 0);
        ctx.lineTo(px, ch);
        ctx.stroke();
      });
      linTicks(ymin, ymax, 12).forEach((wy) => {
        const { py } = pixelFromWorld(0, wy, xmin, xmax, ymin, ymax, cw, ch);
        if (py < 0 || py > ch) return;
        ctx.beginPath();
        ctx.moveTo(0, py);
        ctx.lineTo(cw, py);
        ctx.stroke();
      });

      ctx.globalAlpha = 1;
      ctx.strokeStyle = axis;
      ctx.lineWidth = 1.25;

      if (ymin < 0 && ymax > 0) {
        const y0 = pixelFromWorld(0, 0, xmin, xmax, ymin, ymax, cw, ch).py;
        ctx.beginPath();
        ctx.moveTo(0, y0);
        ctx.lineTo(cw, y0);
        ctx.stroke();
      }
      if (xmin < 0 && xmax > 0) {
        const x0 = pixelFromWorld(0, 0, xmin, xmax, ymin, ymax, cw, ch).px;
        ctx.beginPath();
        ctx.moveTo(x0, 0);
        ctx.lineTo(x0, ch);
        ctx.stroke();
      }

      if (activeFns.length === 0 && !gameMode) {
        errEl.textContent = lastCompileErr || "";
        ctx.fillStyle = cssColor("--muted", "#888");
        ctx.font = "14px system-ui,sans-serif";
        ctx.fillText(
          lastCompileErr ? "Fix errors above or enter a valid equation." : "Enter at least one equation and tap Plot.",
          14,
          26,
        );
        return;
      }

      if (activeFns.length === 0 && gameMode) {
        errEl.textContent = lastCompileErr || "";
        ctx.fillStyle = cssColor("--muted", "#888");
        ctx.font = "13px system-ui,sans-serif";
        ctx.fillText("Plot at least one y=f(x) curve as a ramp, then tap Play.", 14, 24);
      }

      ctx.lineWidth = 2;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";

      function strokeCurve(fn, color) {
        ctx.strokeStyle = color;
        let prev = null;
        for (let i = 0; i <= samples; i++) {
          const x = xmin + ((xmax - xmin) * i) / samples;
          const y = fn(x);
          const px = ((x - xmin) / (xmax - xmin)) * cw;
          const py = ((ymax - y) / (ymax - ymin)) * ch;
          if (!Number.isFinite(y) || py < -200 || py > ch + 200) {
            prev = null;
            continue;
          }
          if (prev) {
            const jump = Math.abs(y - prev.y);
            const thr = Math.abs(ymax - ymin) * 3;
            if (jump > thr) {
              prev = { px, py, y };
              continue;
            }
            ctx.beginPath();
            ctx.moveTo(prev.px, prev.py);
            ctx.lineTo(px, py);
            ctx.stroke();
          }
          prev = { px, py, y };
        }
      }

      function strokeCurveXY(fn, color) {
        ctx.strokeStyle = color;
        let prev = null;
        for (let i = 0; i <= samples; i++) {
          const y = ymin + ((ymax - ymin) * i) / samples;
          const x = fn(y);
          const px = ((x - xmin) / (xmax - xmin)) * cw;
          const py = ((ymax - y) / (ymax - ymin)) * ch;
          if (!Number.isFinite(x) || px < -200 || px > cw + 200) {
            prev = null;
            continue;
          }
          if (prev) {
            const jump = Math.abs(x - prev.x);
            const thr = Math.abs(xmax - xmin) * 3;
            if (jump > thr) {
              prev = { px, py, x };
              continue;
            }
            ctx.beginPath();
            ctx.moveTo(prev.px, prev.py);
            ctx.lineTo(px, py);
            ctx.stroke();
          }
          prev = { px, py, x };
        }
      }

      if (activeFns.length > 0) {
        for (let fi = 0; fi < compiled.length; fi++) {
          const row = compiled[fi];
          if (!row) continue;
          const color = GRAPH_COLORS[fi] || "#888";
          if (row.kind === "xy") strokeCurveXY(row.fn, color);
          else strokeCurve(row.fn, color);
        }
      }

      errEl.textContent = lastCompileErr || "";
      if (gameMode) drawGameOverlay(xmin, xmax, ymin, ymax, cw, ch);
    }

    function compileExpressions() {
      const errs = [];
      compiled = [null, null, null, null, null, null];
      exprEls.forEach((el, idx) => {
        if (!el) return;
        const raw = String(el.value || "").trim();
        if (!raw) return;
        try {
          const row = compileExpr(raw);
          row.fn(0);
          compiled[idx] = row;
        } catch (e) {
          errs.push(`${idx + 1}: ${e.message || String(e)}`);
        }
      });
      lastCompileErr = errs.length ? errs.join(" · ") : "";
    }

    function compileAndPlot() {
      if (simRunning) stopSimulation();
      compileExpressions();
      draw(false);
    }

    plotBtn?.addEventListener("click", compileAndPlot);
    exprEls.forEach((el) => {
      el?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") compileAndPlot();
      });
    });

    fitBtn?.addEventListener("click", () => {
      autoYEl.checked = true;
      compileAndPlot();
    });

    zoomInBtn?.addEventListener("click", () => {
      if (simRunning) return;
      const xc = (parseFloatSafe(xMinEl, -10) + parseFloatSafe(xMaxEl, 10)) / 2;
      const yc = (parseFloatSafe(yMinEl, -10) + parseFloatSafe(yMaxEl, 10)) / 2;
      const xhw = ((parseFloatSafe(xMaxEl, 10) - parseFloatSafe(xMinEl, -10)) / 2) * 0.72;
      const yhw = ((parseFloatSafe(yMaxEl, 10) - parseFloatSafe(yMinEl, -10)) / 2) * 0.72;
      xMinEl.value = String(Math.round((xc - xhw) * 10000) / 10000);
      xMaxEl.value = String(Math.round((xc + xhw) * 10000) / 10000);
      yMinEl.value = String(Math.round((yc - yhw) * 10000) / 10000);
      yMaxEl.value = String(Math.round((yc + yhw) * 10000) / 10000);
      draw();
    });

    zoomOutBtn?.addEventListener("click", () => {
      if (simRunning) return;
      const xc = (parseFloatSafe(xMinEl, -10) + parseFloatSafe(xMaxEl, 10)) / 2;
      const yc = (parseFloatSafe(yMinEl, -10) + parseFloatSafe(yMaxEl, 10)) / 2;
      const xhw = ((parseFloatSafe(xMaxEl, 10) - parseFloatSafe(xMinEl, -10)) / 2) / 0.72;
      const yhw = ((parseFloatSafe(yMaxEl, 10) - parseFloatSafe(yMinEl, -10)) / 2) / 0.72;
      xMinEl.value = String(Math.round((xc - xhw) * 10000) / 10000);
      xMaxEl.value = String(Math.round((xc + xhw) * 10000) / 10000);
      yMinEl.value = String(Math.round((yc - yhw) * 10000) / 10000);
      yMaxEl.value = String(Math.round((yc + yhw) * 10000) / 10000);
      draw();
    });

    canvas.addEventListener("mousedown", (e) => {
      if (simRunning) return;
      const rect = canvas.getBoundingClientRect();
      drag = {
        sx: e.clientX,
        sy: e.clientY,
        xmin: parseFloatSafe(xMinEl, -10),
        xmax: parseFloatSafe(xMaxEl, 10),
        ymin: parseFloatSafe(yMinEl, -10),
        ymax: parseFloatSafe(yMaxEl, 10),
        cw: rect.width,
        ch: rect.height,
      };
    });

    window.addEventListener("mouseup", () => {
      drag = null;
    });

    window.addEventListener("mousemove", (e) => {
      if (!drag || simRunning) return;
      const dx = e.clientX - drag.sx;
      const dy = e.clientY - drag.sy;
      const spanx = drag.xmax - drag.xmin;
      const spany = drag.ymax - drag.ymin;
      const sx = (-dx / drag.cw) * spanx;
      const sy = (dy / drag.ch) * spany;
      xMinEl.value = String(Math.round((drag.xmin + sx) * 10000) / 10000);
      xMaxEl.value = String(Math.round((drag.xmax + sx) * 10000) / 10000);
      yMinEl.value = String(Math.round((drag.ymin + sy) * 10000) / 10000);
      yMaxEl.value = String(Math.round((drag.ymax + sy) * 10000) / 10000);
      draw();
    });

    canvas.addEventListener(
      "wheel",
      (e) => {
        if (simRunning) return;
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const px = e.clientX - rect.left;
        const py = e.clientY - rect.top;
        const xmin = parseFloatSafe(xMinEl, -10);
        const xmax = parseFloatSafe(xMaxEl, 10);
        const ymin = parseFloatSafe(yMinEl, -10);
        const ymax = parseFloatSafe(yMaxEl, 10);
        const cw = rect.width;
        const ch = rect.height;
        const wx = xmin + (px / cw) * (xmax - xmin);
        const wy = ymax - (py / ch) * (ymax - ymin);
        const factor = e.deltaY > 0 ? 1.08 : 1 / 1.08;
        let nxmin = wx + (xmin - wx) * factor;
        let nxmax = wx + (xmax - wx) * factor;
        let nymin = wy + (ymin - wy) * factor;
        let nymax = wy + (ymax - wy) * factor;
        xMinEl.value = String(Math.round(nxmin * 10000) / 10000);
        xMaxEl.value = String(Math.round(nxmax * 10000) / 10000);
        yMinEl.value = String(Math.round(nymin * 10000) / 10000);
        yMaxEl.value = String(Math.round(nymax * 10000) / 10000);
        draw();
      },
      { passive: false },
    );

    function syncGameModeSwitchUi() {
      if (!gameModeSwitch) return;
      gameModeSwitch.checked = gameMode;
      gameModeSwitch.setAttribute("aria-checked", gameMode ? "true" : "false");
      gameModeSwitch.closest(".graphcalc-game-switch")?.classList.toggle("graphcalc-game-switch-on", gameMode);
    }

    gameModeSwitch?.addEventListener("change", () => {
      gameMode = !!gameModeSwitch.checked;
      syncGameModeSwitchUi();
      if (graphcalcPlayDock) graphcalcPlayDock.hidden = !gameMode;
      if (!gameMode) {
        stopSimulation();
        gameOutcome = null;
        ballVisible = true;
        barriers.length = 0;
        if (graphcalcGameStatus) graphcalcGameStatus.textContent = "";
      } else {
        const b = getWorldBounds();
        if (b.xmax > b.xmin && b.ymax > b.ymin) {
          gameLevel = 1;
          randomizeLevel(b.xmin, b.xmax, b.ymin, b.ymax);
          ballVisible = true;
          gameOutcome = null;
        }
        if (graphcalcGameStatus) graphcalcGameStatus.textContent = "Plot y=f(x) ramps, then tap Play.";
      }
      draw(gameMode ? true : false);
    });

    syncGameModeSwitchUi();

    graphcalcPlayBtn?.addEventListener("click", () => {
      if (!gameMode) return;
      if (simRunning) stopSimulation();
      compileExpressions();
      draw(true);
      const b = getWorldBounds();
      if (!(b.xmax > b.xmin && b.ymax > b.ymin)) {
        if (graphcalcGameStatus) graphcalcGameStatus.textContent = "Adjust the graph window first.";
        return;
      }
      resetBallToSpawn();
      ballVisible = true;
      gameOutcome = null;
      const barrierHint =
        barriers.length === 0 ? "" : ` · ${barriers.length} barrier${barriers.length > 1 ? "s" : ""}`;
      if (graphcalcGameStatus) {
        graphcalcGameStatus.textContent = `Rolling · puzzle ${gameLevel}${barrierHint}`;
      }
      simRunning = true;
      setSimCanvasStyle(true);
      lastPhysicsTs = performance.now();
      if (gameRaf) cancelAnimationFrame(gameRaf);
      gameRaf = requestAnimationFrame(gameLoop);
    });

    window.addEventListener("resize", resizeCanvas);

    new MutationObserver(() => {
      if (panel.classList.contains("active")) {
        resizeCanvas();
        compileAndPlot();
      }
    }).observe(panel, { attributes: true, attributeFilter: ["class"] });

    new MutationObserver(() => {
      if (panel.classList.contains("active")) draw(!!(simRunning || gameMode));
    }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    resizeCanvas();
    compileAndPlot();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", GraphCalc);
  } else {
    GraphCalc();
  }
})();
