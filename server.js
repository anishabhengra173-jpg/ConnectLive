const http = require("http");
const fs = require("fs");
const path = require("path");
const { WebSocketServer, WebSocket } = require("ws");

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, "public");
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  const requested = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const file = path.resolve(PUBLIC, requested);
  if (!file.startsWith(PUBLIC + path.sep) && file !== path.join(PUBLIC, "index.html")) {
    res.writeHead(403); return res.end("Forbidden");
  }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end("Not found"); }
    const ext = path.extname(file);
    const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8" };
    res.writeHead(200, { "Content-Type": types[ext] || "application/octet-stream", "X-Content-Type-Options": "nosniff" });
    res.end(data);
  });
});
const wss = new WebSocketServer({ server });
const waiting = [];
const partner = new Map();
const clients = new Map();
const reports = [];

function send(ws, obj) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
}
function removeFromQueue(ws) {
  const i = waiting.indexOf(ws);
  if (i !== -1) waiting.splice(i, 1);
}
function endPair(ws, notify = true) {
  removeFromQueue(ws);
  const other = partner.get(ws);
  partner.delete(ws);
  if (other) {
    partner.delete(other);
    if (notify) send(other, { type: "peer-left" });
  }
}
function tryMatch(ws) {
  if (partner.has(ws) || ws.readyState !== WebSocket.OPEN) return;
  const idx = waiting.findIndex(candidate => candidate !== ws && candidate.readyState === WebSocket.OPEN);
  if (idx < 0) {
    if (!waiting.includes(ws)) waiting.push(ws);
    send(ws, { type: "waiting" });
    return;
  }
  const other = waiting.splice(idx, 1)[0];
  if (!other || other.readyState !== WebSocket.OPEN) return tryMatch(ws);
  partner.set(ws, other); partner.set(other, ws);
  const room = Math.random().toString(36).slice(2, 10);
  send(ws, { type: "matched", initiator: true, room });
  send(other, { type: "matched", initiator: false, room });
}
wss.on("connection", ws => {
  const id = Math.random().toString(36).slice(2, 11);
  clients.set(ws, id);
  ws.on("message", raw => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    if (!msg || typeof msg.type !== "string") return;
    if (msg.type === "find") { tryMatch(ws); return; }
    if (msg.type === "leave") { endPair(ws); return; }
    const other = partner.get(ws);
    if (["offer", "answer", "ice"].includes(msg.type)) {
      if (!other) return;
      send(other, { type: msg.type, payload: msg.payload });
    } else if (msg.type === "report") {
      reports.push({ reporter: id, category: String(msg.category || "unspecified").slice(0, 80), at: new Date().toISOString() });
      endPair(ws);
      send(ws, { type: "report-received" });
    } else if (msg.type === "block") {
      endPair(ws);
      send(ws, { type: "blocked" });
    }
  });
  ws.on("close", () => { endPair(ws); removeFromQueue(ws); clients.delete(ws); });
  ws.on("error", () => { endPair(ws); });
});
server.listen(PORT, "0.0.0.0", () => console.log(`ConnectLive prototype running at http://localhost:${PORT}`));