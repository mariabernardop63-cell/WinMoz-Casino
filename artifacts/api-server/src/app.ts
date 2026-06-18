import express, { type Express, type Request, type Response, type NextFunction } from "express";
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

/* ── Security Headers ── */
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "geolocation=(), camera=(), microphone=()");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  next();
});

/* ── CORS — only allow same-origin and Vercel domains ── */
const allowedOrigins = [
  /^https?:\/\/localhost(:\d+)?$/,
  /\.vercel\.app$/,
  /\.replit\.dev$/,
  /\.replit\.app$/,
  /pokerwinner\.online$/,
  /mozbet\./,
];

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    const ok = allowedOrigins.some(p => p.test(origin));
    cb(ok ? null : new Error("Not allowed by CORS"), ok);
  },
  credentials: true,
}));

app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));

app.use("/api", router);

/* ── 404 for unknown /api routes ── */
app.use("/api", (_req: Request, res: Response) => {
  res.status(404).json({ error: "Not found" });
});

// Serve built frontend in production (when Vite dist exists)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const distPath = resolve(__dirname, "../../winmoz/dist/public");

if (existsSync(distPath)) {
  app.use(express.static(distPath, { maxAge: 0 }));
  app.get("/{*splat}", (_req, res) => {
    res.sendFile(resolve(distPath, "index.html"));
  });
}

export default app;
