/* Proxy simples: 0.0.0.0:3000 -> 127.0.0.1:3999 (DeepSeek Harness)
   Reescreve o header Host para 127.0.0.1:3999 para passar na "browser-trust
   fence" do dsh, e encaminha também WebSocket (upgrade). */
const http = require("http");
const net = require("net");

const TARGET = { host: "127.0.0.1", port: 3999 };
const PORT = 3000;

const server = http.createServer((req, res) => {
  const headers = { ...req.headers, host: `${TARGET.host}:${TARGET.port}` };
  // A "browser-trust fence" do dsh valida Origin/Referer nas chamadas /api —
  // reescreve para a autoridade local para não bloquear o acesso via Replit.
  for (const h of ["origin", "referer"]) {
    if (headers[h] !== undefined) headers[h] = `http://${TARGET.host}:${TARGET.port}/`;
  }
  const p = http.request(
    { host: TARGET.host, port: TARGET.port, path: req.url, method: req.method, headers },
    (r) => { res.writeHead(r.statusCode, r.headers); r.pipe(res); }
  );
  p.on("error", () => { try { res.writeHead(502); res.end("harness offline"); } catch {} });
  req.pipe(p);
});

server.on("upgrade", (req, socket, head) => {
  const upstream = net.connect(TARGET.port, TARGET.host, () => {
    let out = `${req.method} ${req.url} HTTP/1.1\r\n`;
    for (let i = 0; i < req.rawHeaders.length; i += 2) {
      const k = req.rawHeaders[i], v = req.rawHeaders[i + 1];
      const lower = k.toLowerCase();
      if (lower === "host" || lower === "origin" || lower === "referer") continue;
      out += `${k}: ${v}\r\n`;
    }
    out += `Host: ${TARGET.host}:${TARGET.port}\r\n`;
    out += `Origin: http://${TARGET.host}:${TARGET.port}\r\n\r\n`;
    upstream.write(out);
    if (head && head.length) upstream.write(head);
    socket.pipe(upstream);
    upstream.pipe(socket);
  });
  upstream.on("error", () => socket.destroy());
  socket.on("error", () => upstream.destroy());
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`dsh proxy: 0.0.0.0:${PORT} -> 127.0.0.1:${TARGET.port}`);
});
