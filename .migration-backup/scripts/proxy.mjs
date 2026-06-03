import http from "http";
import net from "net";

const FRONTEND_PORT = 5000;
const BACKEND_PORT = 3000;
const PROXY_PORT = 8081;
const RETRY_ATTEMPTS = 6;
const RETRY_DELAY_MS = 500;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildHeaders(req, targetPort, bodyLength) {
  const headers = {};
  for (const [key, value] of Object.entries(req.headers)) {
    const lk = key.toLowerCase();
    // drop hop-by-hop headers that should not be forwarded
    if (lk === "transfer-encoding" || lk === "connection" || lk === "keep-alive" || lk === "upgrade" || lk === "proxy-authorization") {
      continue;
    }
    headers[lk] = value;
  }
  // set a definite content-length (we have the full body buffered)
  headers["content-length"] = String(bodyLength);
  if (targetPort === BACKEND_PORT) {
    headers["x-forwarded-proto"] = "https";
    headers["x-forwarded-host"] = req.headers.host || "";
  }
  return headers;
}

function forwardOnce(req, body, targetPort) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "localhost",
      port: targetPort,
      path: req.url,
      method: req.method,
      headers: buildHeaders(req, targetPort, body.length),
    };

    const proxyReq = http.request(options, (proxyRes) => {
      resolve(proxyRes);
    });

    proxyReq.on("error", reject);
    if (body.length > 0) {
      proxyReq.write(body);
    }
    proxyReq.end();
  });
}

async function forward(req, res, targetPort) {
  // buffer the entire request body first
  const chunks = [];
  try {
    for await (const chunk of req) {
      chunks.push(chunk);
    }
  } catch {
    // request aborted
    return;
  }
  const body = Buffer.concat(chunks);

  let lastErr;
  for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      await sleep(RETRY_DELAY_MS);
    }
    try {
      const proxyRes = await forwardOnce(req, body, targetPort);
      if (!res.headersSent) {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res, { end: true });
      }
      return;
    } catch (err) {
      lastErr = err;
      const transient = err.code === "ECONNREFUSED" || err.code === "ECONNRESET" || err.code === "ETIMEDOUT" || err.code === "ENOTFOUND";
      if (!transient) break;
    }
  }

  if (!res.headersSent) {
    res.writeHead(503);
    res.end(JSON.stringify({ error: "Serviço temporariamente indisponível. Tente novamente." }));
  }
}

const proxy = http.createServer((req, res) => {
  const isApi = req.url && req.url.startsWith("/api");
  forward(req, res, isApi ? BACKEND_PORT : FRONTEND_PORT);
});

proxy.on("upgrade", (req, socket, head) => {
  const targetPort = (req.url && req.url.startsWith("/api")) ? BACKEND_PORT : FRONTEND_PORT;
  const extraHeaders = targetPort === BACKEND_PORT
    ? `x-forwarded-proto: https\r\nx-forwarded-host: ${req.headers.host || ""}\r\n`
    : "";
  const target = net.createConnection(targetPort, "localhost", () => {
    target.write(
      `${req.method} ${req.url} HTTP/1.1\r\n` +
        Object.entries(req.headers)
          .map(([k, v]) => `${k}: ${v}`)
          .join("\r\n") +
        "\r\n" +
        extraHeaders +
        "\r\n"
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
