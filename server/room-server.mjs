/**
 * Minimal WebSocket room server for 2-player chess & checkers.
 * Run: npm install && npm run rooms   (listens on PORT or 3333)
 */
import { WebSocketServer } from "ws";

const PORT = process.env.PORT || 3333;
const ALPH = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomCode() {
  let s = "";
  for (let i = 0; i < 6; i++) s += ALPH[Math.floor(Math.random() * ALPH.length)];
  return s;
}

/** @type {Map<string, { game: string, options: object, host: import('ws').WebSocket, guest: import('ws').WebSocket | null, last: object | null }>} */
const rooms = new Map();

function send(ws, obj) {
  if (ws.readyState === 1) ws.send(JSON.stringify(obj));
}

function other(code, self) {
  const r = rooms.get(code);
  if (!r) return null;
  if (r.host === self) return r.guest;
  if (r.guest === self) return r.host;
  return null;
}

const wss = new WebSocketServer({ port: PORT });
console.log(`BIC room server listening on ws://localhost:${PORT}`);

wss.on("connection", (ws) => {
  let roomCode = null;
  let isHost = false;

  ws.on("message", (raw) => {
    let data;
    try {
      data = JSON.parse(String(raw));
    } catch {
      return;
    }
    const t = data.type;
    if (t === "create") {
      if (roomCode) return;
      const game = data.game;
      if (game !== "chess" && game !== "checkers") {
        return send(ws, { type: "error", code: "bad_game" });
      }
      let code = randomCode();
      let tries = 0;
      while (rooms.has(code) && tries < 20) {
        code = randomCode();
        tries++;
      }
      if (rooms.has(code)) {
        return send(ws, { type: "error", code: "room_gen_failed" });
      }
      const options = data.options && typeof data.options === "object" ? data.options : {};
      roomCode = code;
      isHost = true;
      rooms.set(code, { game, options, host: ws, guest: null, last: null });
      send(ws, { type: "created", code, game, role: "host" });
    } else if (t === "join") {
      if (roomCode) return;
      const code = (data.code || "").toString().toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (code.length < 4) {
        return send(ws, { type: "error", code: "bad_code" });
      }
      const r = rooms.get(code);
      if (!r) {
        return send(ws, { type: "error", code: "not_found" });
      }
      if (r.guest) {
        return send(ws, { type: "error", code: "full" });
      }
      r.guest = ws;
      roomCode = code;
      isHost = false;
      send(ws, { type: "joined", code, game: r.game, role: "guest", options: r.options, state: r.last });
      if (r.host) {
        send(r.host, { type: "peer_joined" });
      }
    } else if (t === "move" && roomCode) {
      const r = rooms.get(roomCode);
      if (!r) return;
      const p = data.payload;
      if (p && typeof p === "object") {
        r.last = p;
      }
      const o = other(roomCode, ws);
      if (o) send(o, { type: "move", game: r.game, payload: p });
    } else if (t === "ping") {
      send(ws, { type: "pong" });
    }
  });

  ws.on("close", () => {
    if (!roomCode) return;
    const r = rooms.get(roomCode);
    if (!r) return;
    if (r.host === ws) {
      if (r.guest) send(r.guest, { type: "peer_left" });
      rooms.delete(roomCode);
    } else if (r.guest === ws) {
      r.guest = null;
      if (r.host) send(r.host, { type: "peer_left" });
    }
  });
});
