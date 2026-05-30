import http from "http";
import net from "net";

const FRONTEND_PORT = 5000;
const BACKEND_PORT = 3000;
const PROXY_PORT = 8081;

function forward(req, res, targetPort) {
  const options = {
    hostname: "localhost",
    port: targetPort,
    path: req.url,
    method: req.method,
    headers: req.headers,
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on("error", (err) => {
    res.writeHead(502);
    res.end(`Proxy error: ${err.message}`);
  });

  req.pipe(proxyReq, { end: true });
}

const proxy = http.createServer((req, res) => {
  if (req.url && req.url.startsWith("/api")) {
    forward(req, res, BACKEND_PORT);
  } else {
    forward(req, res, FRONTEND_PORT);
  }
});

proxy.on("upgrade", (req, socket, head) => {
  const targetPort = (req.url && req.url.startsWith("/api")) ? BACKEND_PORT : FRONTEND_PORT;
  const target = net.createConnection(targetPort, "localhost", () => {
    target.write(
      `${req.method} ${req.url} HTTP/1.1\r\n` +
        Object.entries(req.headers)
          .map(([k, v]) => `${k}: ${v}`)
          .join("\r\n") +
        "\r\n\r\n"
    );
    if (head && head.length) target.write(head);
    socket.pipe(target);
    target.pipe(socket);
  });

  target.on("error", () => socket.destroy());
  socket.on("error", () => target.destroy());
});

proxy.listen(PROXY_PORT, "0.0.0.0", () => {
  console.log(`Proxy listening on port ${PROXY_PORT} → /api → ${BACKEND_PORT}, rest → ${FRONTEND_PORT}`);
});
