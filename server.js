// server.js — Custom Next.js server
// WebSocket /api/stt-fallback proxies PCM16 audio to IBM Watson Speech-to-Text.
// Start with: npm run dev:ws

const fs = require("fs");
const path = require("path");
const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { WebSocketServer, WebSocket } = require("ws");

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

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

function watsonRecognizeUrl(raw, model) {
  let url = String(raw || "").trim().replace(/\/$/, "");
  if (!url) return "";
  url = url.replace(/^https:/i, "wss:").replace(/^http:/i, "ws:");
  if (!url.includes("/v1/recognize")) {
    url = `${url}/v1/recognize`;
  }
  const parsed = new URL(url);
  parsed.searchParams.set("model", model);
  return parsed.toString();
}

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const wss = new WebSocketServer({ noServer: true });

  wss.on("connection", (clientWs, req) => {
    const parsedUrl = parse(req.url, true);
    const model =
      parsedUrl.query.model === "en-IN_Telephony"
        ? "en-IN_Telephony"
        : "hi-IN_Telephony";

    const watsonKey = process.env.WATSON_STT_API_KEY;
    const watsonBase = process.env.WATSON_STT_URL;
    if (!watsonKey || !watsonBase) {
      clientWs.close(1011, "Watson STT is not configured");
      return;
    }

    const watsonUrl = watsonRecognizeUrl(watsonBase, model);
    const auth = Buffer.from(`apikey:${watsonKey}`).toString("base64");
    const pending = [];
    let watsonReady = false;

    const watsonWs = new WebSocket(watsonUrl, {
      headers: { Authorization: `Basic ${auth}` },
    });

    function sendToWatson(data) {
      if (watsonWs.readyState !== WebSocket.OPEN) return;
      watsonWs.send(data);
    }

    watsonWs.on("open", () => {
      sendToWatson(
        JSON.stringify({
          action: "start",
          "content-type": "audio/l16;rate=16000",
          interim_results: true,
          smart_formatting: true,
        })
      );
      watsonReady = true;
      for (const frame of pending) sendToWatson(frame);
      pending.length = 0;
    });

    watsonWs.on("message", (data) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(data.toString());
      }
    });

    watsonWs.on("error", (err) => {
      console.error("[Watson STT]", err.message);
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({ error: err.message }));
        clientWs.close(1011, "Watson STT error");
      }
    });

    watsonWs.on("close", () => {
      if (clientWs.readyState === WebSocket.OPEN) clientWs.close();
    });

    clientWs.on("message", (data) => {
      if (watsonReady) {
        sendToWatson(data);
        return;
      }
      if (pending.length < 40) pending.push(data);
    });

    clientWs.on("close", () => {
      if (watsonWs.readyState === WebSocket.OPEN) {
        try {
          sendToWatson(JSON.stringify({ action: "stop" }));
        } catch {
          // Closing anyway.
        }
        watsonWs.close();
      }
    });
  });

  server.on("upgrade", (req, socket, head) => {
    const { pathname } = parse(req.url);
    if (pathname === "/api/stt-fallback") {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
      });
    }
    // Do not destroy other upgrades (Next.js HMR).
  });

  const port = process.env.PORT || 3000;
  server.listen(port, () => {
    console.log(`> Sampark ready on http://localhost:${port}`);
  });
});
