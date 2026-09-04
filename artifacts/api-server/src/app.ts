import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
/* CORS allowlist — the app is same-origin (vite proxy / static serving),
   so cross-origin browser calls are blocked; server-to-server (no Origin
   header) and known hosts keep working. */
const ALLOWED_ORIGIN_RE = [
  /\.replit\.dev$/,
  /\.repl\.co$/,
  /\.replit\.app$/,
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
  /(^|\.)mozbet\.online$/,
  /(^|\.)pokerwinner\.online$/,
  /\.vercel\.app$/,
];
app.use(
  cors({
    origin(origin, cb) {
      if (!origin || ALLOWED_ORIGIN_RE.some(re => re.test(origin))) {
        cb(null, true);
      } else {
        cb(null, false);
      }
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 86400,
  }),
);
/* Captura o raw body para validar o HMAC do webhook Debito Pay */
app.use(express.json({
  verify: (req: any, _res, buf) => {
    (req as any).rawBody = buf.toString("utf8");
  },
}));
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// Serve built frontend in production (when Vite dist exists)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const distPath = resolve(__dirname, "../../winmoz/dist/public");

if (existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get("/{*splat}", (_req, res) => {
    res.sendFile(resolve(distPath, "index.html"));
  });
}

export default app;
