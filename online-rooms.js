/* ============================================================
   WebSocket room client — create/join with random 6-char codes.
   Lobby UI lives under Chess / Checkers panels ([data-bic-game]).
   Expects: npm run rooms (or ws:// URL you host).
   ============================================================ */
(() => {
  "use strict";

  const URL_KEY = "bic.wsroom.url";
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
      } catch {
        /* */
      }
    },
  };

  function defaultUrl() {
    return store.get(URL_KEY, "ws://localhost:3333");
  }

  let ws = null;
  let state = { room: null, game: null, role: null, options: null };

  function bicGoto(name) {
    const main =
      name === "chessplay" || name === "checkers" || name === "chess" ? "board" : name;
    document.querySelectorAll("#tabs .tab").forEach((t) => {
      t.classList.toggle("active", t.dataset.tab === main);
    });
    document.querySelectorAll(".panel").forEach((p) => {
      p.classList.toggle("active", p.id === "panel-" + name);
    });
  }

  function setStatus(el, t) {
    if (el) el.textContent = t;
  }

  function syncWsInputs(val) {
    document.querySelectorAll('[data-bic-role="ws-url"]').forEach((el) => {
      el.value = val;
    });
  }

  function connect(wsUrlExplicit) {
    const raw = typeof wsUrlExplicit === "string" ? wsUrlExplicit.trim() : "";
    const u = raw || defaultUrl();
    store.set(URL_KEY, u);
    syncWsInputs(u);
    return new Promise((resolve, reject) => {
      if (ws && ws.readyState === 1) {
        resolve(ws);
        return;
      }
      if (ws) {
        try {
          ws.close();
        } catch {
          /* */
        }
        ws = null;
      }
      const s = new WebSocket(u);
      s.addEventListener("open", () => {
        ws = s;
        resolve(s);
      });
      s.addEventListener("error", () => {
        reject(new Error("connect"));
      });
      s.addEventListener("message", (ev) => {
        let d;
        try {
          d = JSON.parse(ev.data);
        } catch {
          return;
        }
        if (d.type === "move" && d.game === "chess" && d.payload && window.bicApplyChessFen) {
          window.bicApplyChessFen(d.payload.fen);
        }
        if (d.type === "move" && d.game === "checkers" && d.payload && window.bicApplyCheckersNet) {
          window.bicApplyCheckersNet(d.payload);
        }
        if (d.type === "peer_left") {
          if (typeof window.bicOnPeerLeftChess === "function") window.bicOnPeerLeftChess();
          if (typeof window.bicOnPeerLeftCheckers === "function") window.bicOnPeerLeftCheckers();
        }
        window.dispatchEvent(new CustomEvent("bicroom", { detail: d }));
      });
      s.addEventListener("close", () => {
        ws = null;
        state = { room: null, game: null, role: null, options: null };
        window.dispatchEvent(new CustomEvent("bicroom", { detail: { type: "disconnected" } }));
      });
    });
  }

  function send(type, data = {}) {
    if (!ws || ws.readyState !== 1) return;
    ws.send(JSON.stringify({ type, ...data }));
  }

  function sendMove(game, payload) {
    send("move", { game, payload });
  }

  window.bicSendRoomMove = sendMove;

  function bindLobbyRoots() {
    const roots = document.querySelectorAll("[data-bic-game]");
    if (!roots.length) return;

    syncWsInputs(defaultUrl());

    function showGo(goBtn, gameKind, role) {
      if (!goBtn) return;
      goBtn.hidden = false;
      goBtn.onclick = () => {
        if (gameKind === "chess") {
          if (window.bicStartChessOnline) window.bicStartChessOnline(role === "host");
          bicGoto("chessplay");
        } else {
          if (window.bicStartCheckersOnline) window.bicStartCheckersOnline(role === "host");
          bicGoto("checkers");
        }
      };
    }

    window.addEventListener("bicroom", (e) => {
      const d = e.detail;
      roots.forEach((root) => {
        const g = root.getAttribute("data-bic-game");
        if (g !== "chess" && g !== "checkers") return;
        const stEl = root.querySelector('[data-bic-role="status"]');
        const codeEl = root.querySelector('[data-bic-role="room-code"]');
        const goBtn = root.querySelector('[data-bic-role="go-game"]');

        if (d.type === "created" && d.code && d.game === g) {
          setStatus(stEl, "Room created — share the code with your friend.");
          if (codeEl) {
            codeEl.textContent = d.code;
            codeEl.setAttribute("data-code", d.code);
          }
          state = { room: d.code, game: d.game, role: "host", options: null };
          showGo(goBtn, d.game, "host");
        }
        if (d.type === "joined" && d.game === g) {
          setStatus(
            stEl,
            d.game === "chess"
              ? "Joined — you are Black. Open the board when ready."
              : "Joined — you are Black (top). Open the board when ready.",
          );
          if (codeEl) codeEl.textContent = d.code;
          state = { room: d.code, game: d.game, role: "guest", options: d.options || {} };
          if (d.options && d.game === "checkers") {
            window.bicCheckersNetOptions = d.options;
          }
          showGo(goBtn, d.game, "guest");
          if (d.state && d.game === "chess" && d.state.fen) {
            sessionStorage.setItem("bic_chess_start_fen", d.state.fen);
          }
          if (d.state && d.game === "checkers") {
            sessionStorage.setItem("bic_checkers_state", JSON.stringify(d.state));
          }
        }
        if (d.type === "error") {
          setStatus(stEl, "Error: " + (d.code || "unknown"));
        }
        if (d.type === "peer_joined" && state.game === g) {
          setStatus(stEl, "Opponent connected — start the game from the button below.");
        }
        if (d.type === "disconnected") {
          setStatus(stEl, "Disconnected from room server.");
          if (goBtn) goBtn.hidden = true;
          if (codeEl) codeEl.textContent = "";
        }
      });
    });

    roots.forEach((root) => {
      const game = root.getAttribute("data-bic-game");
      if (game !== "chess" && game !== "checkers") return;

      const urlIn = root.querySelector('[data-bic-role="ws-url"]');
      const stEl = root.querySelector('[data-bic-role="status"]');
      const codeEl = root.querySelector('[data-bic-role="room-code"]');
      const goBtn = root.querySelector('[data-bic-role="go-game"]');
      const createBtn = root.querySelector('[data-bic-role="create"]');
      const joinBtn = root.querySelector('[data-bic-role="join-btn"]');
      const joinIn = root.querySelector('[data-bic-role="join-code"]');
      const forcedEl = root.querySelector('[data-bic-role="forced-cb"]');

      if (!urlIn) return;

      urlIn.addEventListener("input", () => {
        const v = urlIn.value.trim();
        store.set(URL_KEY, v);
        syncWsInputs(v);
      });

      if (createBtn) {
        createBtn.addEventListener("click", async () => {
          setStatus(stEl, "Connecting…");
          if (codeEl) codeEl.textContent = "";
          if (goBtn) goBtn.hidden = true;
          try {
            await connect(urlIn.value.trim());
          } catch {
            setStatus(stEl, "Could not connect. Run npm run rooms, or set the server URL above.");
            return;
          }
          if (game === "chess") {
            send("create", { game: "chess" });
          } else {
            const forcedCapture = forcedEl ? forcedEl.checked : true;
            send("create", { game: "checkers", options: { forcedCapture } });
          }
        });
      }

      if (joinBtn) {
        joinBtn.addEventListener("click", async () => {
          const code = (joinIn?.value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
          if (code.length < 4) {
            setStatus(stEl, "Enter a 4–6 character code.");
            return;
          }
          setStatus(stEl, "Joining…");
          try {
            await connect(urlIn.value.trim());
          } catch {
            setStatus(stEl, "Could not connect.");
            return;
          }
          send("join", { code: code.length === 6 ? code : code });
        });
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindLobbyRoots);
  } else {
    bindLobbyRoots();
  }
})();
