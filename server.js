// server.js — Custom Next.js server
// Intercepts WebSocket upgrade requests for /api/stt-fallback and proxies
// audio to IBM Watson Speech-to-Text streaming API.
// All other requests are handled by Next.js normally.
//
// Start with: node server.js   (or update "dev"/"start" scripts in package.json)

const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { WebSocketServer, WebSocket } = require("ws");

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

const WATSON_STT_URL = process.env.WATSON_STT_URL; // e.g. wss://api.us-south.speech-to-text.watson.cloud.ibm.com/v1/recognize
const WATSON_STT_API_KEY = process.env.WATSON_STT_API_KEY;

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  // WebSocket server for /api/stt-fallback
  const wss = new WebSocketServer({ noServer: true });

  wss.on("connection", (clientWs, req) => {
    const parsedUrl = parse(req.url, true);
    const model =
      parsedUrl.query.model === "en-IN_Telephony"
        ? "en-IN_Telephony"
        : "hi-IN_Telephony";

    if (!WATSON_STT_URL || !WATSON_STT_API_KEY) {
      clientWs.close(1011, "WATSON_STT_URL or WATSON_STT_API_KEY not configured");
      return;
    }

    // Build the Watson STT WebSocket URL.
    // Watson STT expects: wss://<host>/v1/recognize?model=<model>&content-type=audio/webm
    const watsonBase = WATSON_STT_URL.replace(/\/v1\/recognize.*$/, "");
    const watsonUrl = `${watsonBase}/v1/recognize?model=${model}&content-type=audio%2Fwebm%3Bcodecs%3Dopus`;

    // Auth: IAM or legacy API key header (Basic auth with "apikey" as user).
    const auth = Buffer.from(`apikey:${WATSON_STT_API_KEY}`).toString("base64");
    const watsonWs = new WebSocket(watsonUrl, {
      headers: { Authorization: `Basic ${auth}` },
    });

    watsonWs.on("open", () => {
      // Send start message to Watson STT.
      watsonWs.send(
        JSON.stringify({
          action: "start",
          content_type: "audio/webm;codecs=opus",
          interim_results: true,
          model,
        })
      );
    });

    // Forward transcript results from Watson → client.
    watsonWs.on("message", (data) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(data);
      }
    });

    watsonWs.on("error", (err) => {
      console.error("[Watson STT]", err.message);
      clientWs.close(1011, err.message);
    });

    watsonWs.on("close", () => clientWs.close());

    // Forward audio frames from client → Watson.
    clientWs.on("message", (data) => {
      if (watsonWs.readyState === WebSocket.OPEN) {
        watsonWs.send(data);
      }
    });

    clientWs.on("close", () => {
      if (watsonWs.readyState === WebSocket.OPEN) {
        // Send stop message before closing.
        watsonWs.send(JSON.stringify({ action: "stop" }));
        watsonWs.close();
      }
    });
  });

  // Intercept HTTP upgrade requests.
  server.on("upgrade", (req, socket, head) => {
    const { pathname } = parse(req.url);
    if (pathname === "/api/stt-fallback") {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
      });
    } else {
      socket.destroy();
    }
  });

  const port = process.env.PORT || 3000;
  server.listen(port, () => {
    console.log(`> Setu ready on http://localhost:${port}`);
  });
});
