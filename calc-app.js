/* ============================================================
   Scientific calculator — expression parser + keyboard controls
   ============================================================ */
(() => {
  "use strict";

  /** Unicode π → pi; optional digit-pi → digit*pi so 3π works like 3*pi */
  function normalizeExpr(raw) {
    let s = String(raw || "")
      .trim()
      .replace(/\u2212/g, "-")
      .replace(/\u03c0/g, "pi")
      .replace(/\u213c/gi, "pi")
      .replace(/\u03a0/g, "pi");
    s = s.replace(/(\d)\s*pi\b/gi, "$1*pi");
    s = s.replace(/\)\s*pi\b/gi, ")*pi");
    s = s.replace(/\bpi\b(?=\d)/gi, "pi*");
    s = s.replace(/\bpi\b(?=\()/g, "pi*");
    return s;
  }

  /** Append missing `)` so `sin(30` parses as `sin(30)`. */
  function balanceParens(str) {
    const s = String(str || "");
    let depth = 0;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (c === "(") depth++;
      else if (c === ")") depth--;
    }
    if (depth > 0) return s + ")".repeat(depth);
    return s;
  }

  function tokenize(str) {
    const t = [];
    let i = 0;
    const s = balanceParens(normalizeExpr(str).trim());
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
        if (Number.isNaN(num)) throw new Error(`Invalid number "${slice}"`);
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
      if ("+-*/%^".includes(c)) {
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
      throw new Error(`Unexpected character «${c}»`);
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
        if (op.type === "OP" && (op.val === "*" || op.val === "/" || op.val === "%")) {
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
          if (close.type !== "RPAREN") throw new Error('Expected ")"');
          this.i++;
          return this.funcCall(id, inner);
        }
        if (id === "pi") return { type: "const", val: Math.PI };
        if (id === "e") return { type: "const", val: Math.E };
        throw new Error(`Unknown identifier «${raw}»`);
      }
      if (tok.type === "LPAREN") {
        this.i++;
        const inner = this.parseExpr();
        if (this.peek().type !== "RPAREN") throw new Error('Expected ")"');
        this.i++;
        return inner;
      }
      throw new Error("Expected number, π, e, function, or '('");
    }
    funcCall(name, arg) {
      const allowed = new Set([
        "sin",
        "cos",
        "tan",
        "asin",
        "acos",
        "atan",
        "sinh",
        "cosh",
        "tanh",
        "sqrt",
        "ln",
        "log",
        "abs",
        "exp",
        "floor",
        "ceil",
        "round",
        "sign",
      ]);
      if (!allowed.has(name)) throw new Error(`Unknown function «${name}(…)»`);
      return { type: "call", name, arg };
    }
    parseTop() {
      const ast = this.parseExpr();
      if (!this.eof()) throw new Error("Extra characters after expression");
      return ast;
    }
  }

  function evalAst(node, angleDeg) {
    switch (node.type) {
      case "num":
        return node.val;
      case "const":
        return node.val;
      case "unary":
        return -evalAst(node.arg, angleDeg);
      case "bin": {
        const a = evalAst(node.left, angleDeg);
        const b = evalAst(node.right, angleDeg);
        switch (node.op) {
          case "+":
            return a + b;
          case "-":
            return a - b;
          case "*":
            return a * b;
          case "/":
            return a / b;
          case "%":
            return a % b;
          case "^":
            return Math.pow(a, b);
          default:
            return NaN;
        }
      }
      case "call": {
        const x = evalAst(node.arg, angleDeg);
        const degIn = angleDeg;
        const degOut = angleDeg;
        switch (node.name) {
          case "sin":
            return Math.sin(degIn ? (x * Math.PI) / 180 : x);
          case "cos":
            return Math.cos(degIn ? (x * Math.PI) / 180 : x);
          case "tan":
            return Math.tan(degIn ? (x * Math.PI) / 180 : x);
          case "asin": {
            const r = Math.asin(x);
            return degOut ? (r * 180) / Math.PI : r;
          }
          case "acos": {
            const r = Math.acos(x);
            return degOut ? (r * 180) / Math.PI : r;
          }
          case "atan": {
            const r = Math.atan(x);
            return degOut ? (r * 180) / Math.PI : r;
          }
          case "sinh":
            return Math.sinh ? Math.sinh(x) : (Math.exp(x) - Math.exp(-x)) / 2;
          case "cosh":
            return Math.cosh ? Math.cosh(x) : (Math.exp(x) + Math.exp(-x)) / 2;
          case "tanh":
            return Math.tanh ? Math.tanh(x) : (Math.exp(2 * x) - 1) / (Math.exp(2 * x) + 1);
          case "sqrt":
            return Math.sqrt(x);
          case "ln":
            return Math.log(x);
          case "log":
            return typeof Math.log10 === "function" ? Math.log10(x) : Math.log(x) / Math.LN10;
          case "abs":
            return Math.abs(x);
          case "exp":
            return Math.exp(x);
          case "floor":
            return Math.floor(x);
          case "ceil":
            return Math.ceil(x);
          case "round":
            return Math.round(x);
          case "sign":
            return Math.sign(x);
          default:
            return NaN;
        }
      }
      default:
        return NaN;
    }
  }

  function compileAndEval(expr, angleDeg) {
    const tokens = tokenize(expr);
    const p = new Parser(tokens);
    const ast = p.parseTop();
    return evalAst(ast, angleDeg);
  }

  function formatResult(v) {
    if (!Number.isFinite(v)) return "Math error";
    const abs = Math.abs(v);
    if (abs !== 0 && (abs >= 1e16 || abs < 1e-12)) return v.toExponential(12).replace(/\.?0+e/, "e");
    const s = String(+v.toPrecision(14));
    return s.includes("e") ? v.toExponential(10).replace(/\.?0+e/, "e") : s;
  }

  function CalcApp() {
    const panel = document.getElementById("panel-calculator");
    const displayEl = document.getElementById("calcDisplayInput");
    const memBadge = document.getElementById("calcMemBadge");
    const keysRoot = document.getElementById("calcKeysRoot");
    const degBtn = document.getElementById("calcDegBtn");
    const radBtn = document.getElementById("calcRadBtn");
    if (!panel || !displayEl || !keysRoot) return;

    let angleDeg = true;
    let memory = 0;
    let lastAns = 0;
    let entry = "";

    function syncAngleButtons() {
      if (!degBtn || !radBtn) return;
      degBtn.classList.toggle("calc-angle-active", angleDeg);
      radBtn.classList.toggle("calc-angle-active", !angleDeg);
      degBtn.setAttribute("aria-pressed", angleDeg ? "true" : "false");
      radBtn.setAttribute("aria-pressed", !angleDeg ? "true" : "false");
    }

    function updateMemBadge() {
      if (!memBadge) return;
      memBadge.textContent = memory !== 0 ? `M ${formatResult(memory)}` : "";
    }

    function renderDisplay() {
      displayEl.value = entry;
    }

    function appendStr(s) {
      if (entry === "Error") entry = "";
      entry += s;
      renderDisplay();
    }

    function backspace() {
      if (entry === "Error") {
        entry = "";
      } else {
        entry = entry.slice(0, -1);
      }
      renderDisplay();
    }

    function clearEntry() {
      entry = "";
      renderDisplay();
    }

    function clearAll() {
      entry = "";
      renderDisplay();
    }

    function evaluate() {
      const raw = entry.trim();
      if (!raw) return;
      try {
        const v = compileAndEval(raw, angleDeg);
        lastAns = v;
        entry = formatResult(v);
      } catch {
        entry = "Error";
      }
      renderDisplay();
    }

    function insertAns() {
      appendStr(lastAns !== undefined && Number.isFinite(lastAns) ? String(lastAns) : "0");
    }

    const KEY_DEFS = [
      [
        { t: "mc", lab: "MC" },
        { t: "mr", lab: "MR" },
        { t: "mp", lab: "M+" },
        { t: "mm", lab: "M−" },
        { t: "ms", lab: "MS" },
        { t: "ans", lab: "Ans" },
        { t: "ce", lab: "CE" },
        { t: "ca", lab: "C" },
        { t: "bs", lab: "⌫" },
      ],
      [
        { lab: "√", insert: "sqrt(" },
        { lab: "sin", insert: "sin(" },
        { lab: "cos", insert: "cos(" },
        { lab: "tan", insert: "tan(" },
        { lab: "ln", insert: "ln(" },
        { lab: "log", insert: "log(" },
        { lab: "exp", insert: "exp(" },
      ],
      [
        { lab: "asin", insert: "asin(" },
        { lab: "acos", insert: "acos(" },
        { lab: "atan", insert: "atan(" },
        { lab: "sinh", insert: "sinh(" },
        { lab: "cosh", insert: "cosh(" },
        { lab: "tanh", insert: "tanh(" },
      ],
      [
        { i: "(" },
        { i: ")" },
        { lab: "π", insert: "pi" },
        { lab: "e", insert: "e" },
        { i: "^" },
        { lab: "%", insert: "%", hint: "Modulo remainder" },
      ],
      [
        { lab: "abs", insert: "abs(" },
        { lab: "floor", insert: "floor(" },
        { lab: "ceil", insert: "ceil(" },
        { lab: "round", insert: "round(" },
        { lab: "sign", insert: "sign(" },
      ],
      [
        { n: "7" },
        { n: "8" },
        { n: "9" },
        { op: "/" },
      ],
      [
        { n: "4" },
        { n: "5" },
        { n: "6" },
        { op: "*" },
      ],
      [
        { n: "1" },
        { n: "2" },
        { n: "3" },
        { op: "-" },
      ],
      [{ n: "0", wide: true }, { n: "." }, { op: "+" }, { eq: true }],
    ];

    function buildKeys() {
      keysRoot.innerHTML = "";
      KEY_DEFS.forEach((row, ri) => {
        const rowEl = document.createElement("div");
        rowEl.className = "calc-row";
        if (ri === 0) rowEl.classList.add("calc-row-mem");
        else if (ri === 1 || ri === 2) rowEl.classList.add("calc-row-wide");
        else if (ri === 3) rowEl.classList.add("calc-row-six");
        row.forEach((def) => {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "calc-key";
          if (def.wide) btn.classList.add("calc-key-wide");
          if (def.eq) btn.classList.add("calc-key-eq");
          if (def.n || def.op || def.i || def.insert !== undefined) btn.classList.add("calc-key-insert");

          if (def.eq) {
            btn.textContent = "=";
            btn.title = "Evaluate";
            btn.addEventListener("click", evaluate);
          } else if (def.n) {
            btn.textContent = def.n;
            btn.addEventListener("click", () => appendStr(def.n));
          } else if (def.op) {
            btn.textContent = def.op;
            btn.addEventListener("click", () => appendStr(def.op));
          } else if (def.i !== undefined || def.insert !== undefined) {
            const ins = def.insert !== undefined ? def.insert : def.i;
            btn.textContent = def.lab || def.i || ins;
            if (def.hint) btn.title = def.hint;
            btn.addEventListener("click", () => appendStr(ins));
          } else if (def.t === "mc") {
            btn.textContent = def.lab;
            btn.title = "Memory clear";
            btn.addEventListener("click", () => {
              memory = 0;
              updateMemBadge();
            });
          } else if (def.t === "mr") {
            btn.textContent = def.lab;
            btn.title = "Memory recall";
            btn.addEventListener("click", () => {
              appendStr(Number.isFinite(memory) ? String(memory) : "0");
            });
          } else if (def.t === "mp") {
            btn.textContent = def.lab;
            btn.title = "Memory add";
            btn.addEventListener("click", () => {
              try {
                memory += compileAndEval(entry.trim() || String(lastAns), angleDeg);
              } catch {
                try {
                  memory += lastAns;
                } catch {
                  /* ignore */
                }
              }
              updateMemBadge();
            });
          } else if (def.t === "mm") {
            btn.textContent = def.lab;
            btn.title = "Memory subtract";
            btn.addEventListener("click", () => {
              try {
                memory -= compileAndEval(entry.trim() || String(lastAns), angleDeg);
              } catch {
                memory -= lastAns;
              }
              updateMemBadge();
            });
          } else if (def.t === "ms") {
            btn.textContent = def.lab;
            btn.title = "Memory store";
            btn.addEventListener("click", () => {
              try {
                memory = compileAndEval(entry.trim(), angleDeg);
              } catch {
                memory = lastAns;
              }
              updateMemBadge();
            });
          } else if (def.t === "ans") {
            btn.textContent = def.lab;
            btn.title = "Last answer";
            btn.addEventListener("click", insertAns);
          } else if (def.t === "ce") {
            btn.textContent = def.lab;
            btn.title = "Clear entry";
            btn.addEventListener("click", clearEntry);
          } else if (def.t === "ca") {
            btn.textContent = def.lab;
            btn.title = "Clear all";
            btn.addEventListener("click", clearAll);
          } else if (def.t === "bs") {
            btn.textContent = def.lab;
            btn.title = "Backspace";
            btn.addEventListener("click", backspace);
          }
          rowEl.appendChild(btn);
        });
        keysRoot.appendChild(rowEl);
      });
    }

    degBtn?.addEventListener("click", () => {
      angleDeg = true;
      syncAngleButtons();
    });
    radBtn?.addEventListener("click", () => {
      angleDeg = false;
      syncAngleButtons();
    });
    syncAngleButtons();
    updateMemBadge();
    buildKeys();

    document.addEventListener("keydown", (e) => {
      if (!panel.classList.contains("active")) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const ae = document.activeElement;
      if (ae) {
        const tn = ae.tagName?.toLowerCase();
        if ((tn === "input" || tn === "textarea" || tn === "select") && !panel.contains(ae)) return;
      }

      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        appendStr(e.key);
        return;
      }
      if ("+-*/%^().".includes(e.key)) {
        e.preventDefault();
        appendStr(e.key);
        return;
      }
      if (e.key.length === 1 && /[a-zA-Z]/.test(e.key)) {
        e.preventDefault();
        appendStr(e.key);
        return;
      }
      if (e.key === "Enter" || e.key === "=") {
        e.preventDefault();
        evaluate();
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        clearAll();
        return;
      }
      if (e.key === "Backspace") {
        e.preventDefault();
        backspace();
      }
    });

    new MutationObserver(() => {
      if (panel.classList.contains("active")) renderDisplay();
    }).observe(panel, { attributes: true, attributeFilter: ["class"] });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", CalcApp);
  } else {
    CalcApp();
  }
})();
