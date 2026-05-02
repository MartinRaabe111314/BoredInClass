/* Letter Boxed — helper panel: progress + optional 2-word solution spoiler. */
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function render(d) {
    const el = $("#lbBotBody");
    if (!el) return;
    if (!d || !d.solution || !d.solution[0]) {
      el.innerHTML =
        '<p class="muted">Start a round to see progress and the bot summary.</p>';
      return;
    }
    const s1 = d.solution[0];
    const s2 = d.solution[1];
    const cov = d.usedCount ?? 0;
    const wn = d.wordCount ?? 0;
    let status;
    if (d.done) {
      status = wn === 2 ? "Solved in 2 (par)." : "Cleared in " + wn + " word(s).";
    } else if (wn > 0) {
      status = "In progress — " + wn + " word(s) submitted.";
    } else {
      status = "Not started.";
    }
    const wordsLine =
      d.submitted && d.submitted.length
        ? d.submitted.map((w) => esc(w.toUpperCase())).join(" → ")
        : "—";
    const buf = d.buffer
      ? esc(d.buffer.toUpperCase().split("").join("·"))
      : "—";

    el.innerHTML = `
      <article class="bot-card next">
        <header class="bot-card-head">Coverage</header>
        <p><strong>${cov}</strong> / 12 unique letters from accepted words so far.</p>
        <p class="bot-detail muted">Words: ${wordsLine}</p>
        <p class="bot-detail muted">Current buffer: ${buf}</p>
        <p class="bot-foot">${esc(status)}</p>
        <details class="bot-alts-wrap">
          <summary>Spoiler: one 2-word solution this puzzle was built for</summary>
          <p class="bot-detail"><strong>${esc(s1.toUpperCase())}</strong> + <strong>${esc(
      s2.toUpperCase()
    )}</strong></p>
        </details>
      </article>
    `;
  }

  function syncFromState() {
    if (window.__lastLetterboxedState) {
      requestAnimationFrame(() => render(window.__lastLetterboxedState));
    }
  }

  function init() {
    window.addEventListener("letterboxed:update", (e) => {
      if (e.detail) render(e.detail);
    });
    if (window.__lastLetterboxedState) {
      syncFromState();
    } else {
      render(null);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.LetterboxBot = { sync: syncFromState };
})();
