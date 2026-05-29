import http from "http";
import net from "net";
import { URL } from "url";

const TARGET_PORT = 5000;
const PROXY_PORT = 8081;

const proxy = http.createServer((req, res) => {
  const options = {
    hostname: "localhost",
    port: TARGET_PORT,
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
});

proxy.on("upgrade", (req, socket, head) => {
  const target = net.createConnection(TARGET_PORT, "localhost", () => {
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
  console.log(`Proxy listening on port ${PROXY_PORT} → forwarding to ${TARGET_PORT}`);
});
