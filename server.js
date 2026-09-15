// server.js — Custom Next.js server
// WebSocket /api/room-relay for the two-browser demo call.
// Start with: npm run dev:ws
// Captions are ElevenLabs Scribe only (`npm run dev` is enough for that).

const fs = require("fs");
const path = require("path");
const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { WebSocketServer } = require("ws");

function loadLocalEnv() {
  const file = path.join(__dirname, ".env.local");
  try {
    const text = fs.readFileSync(file, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // .env.local is optional; keys may already be in the environment.
  }
}

loadLocalEnv();

if (process.env.npm_lifecycle_event === "start" && !process.env.NODE_ENV) {
  process.env.NODE_ENV = "production";
}

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const roomWss = new WebSocketServer({ noServer: true });
  const rooms = new Map();

  roomWss.on("connection", (ws, req) => {
    const parsedUrl = parse(req.url, true);
    const roomId = (parsedUrl.query.room || "demo-room").toString();
    const role = (parsedUrl.query.role || "unknown").toString();

    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }
    const clients = rooms.get(roomId);
    clients.add(ws);
    ws.roomId = roomId;
    ws.role = role;

    const peerRoles = [];
    for (const client of clients) {
      if (client !== ws && client.role) peerRoles.push(client.role);
    }

    try {
      ws.send(
        JSON.stringify({
          type: "room-joined",
          roomId,
          role,
          clientCount: clients.size,
          peerRoles,
        })
      );
    } catch {}

    for (const client of clients) {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        try {
          client.send(
            JSON.stringify({
              type: "peer-joined",
              role,
              clientCount: clients.size,
            })
          );
        } catch {}
      }
    }

    ws.on("message", (raw) => {
      const msgStr = raw.toString();
      for (const client of clients) {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          try {
            client.send(msgStr);
          } catch {}
        }
      }
    });

    ws.on("close", () => {
      clients.delete(ws);
      if (clients.size === 0) {
        rooms.delete(roomId);
      } else {
        for (const client of clients) {
          if (client.readyState === WebSocket.OPEN) {
            try {
              client.send(JSON.stringify({ type: "peer-left", role, clientCount: clients.size }));
            } catch {}
          }
        }
      }
    });
  });

  server.on("upgrade", (req, socket, head) => {
    const { pathname } = parse(req.url);
    if (pathname === "/api/room-relay") {
      roomWss.handleUpgrade(req, socket, head, (ws) => {
        roomWss.emit("connection", ws, req);
      });
    }
    // Do not destroy other upgrades (Next.js HMR).
  });

  const port = process.env.PORT || 3000;
  const host = process.env.HOST || "0.0.0.0";
  server.listen(port, host, () => {
    console.log(`> Sampark ready on http://${host}:${port}`);
  });
});
