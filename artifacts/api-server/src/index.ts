import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { readFileSync } from "fs";

// Load env vars from winmoz/.env.local for Replit dev (maps VITE_ keys to server keys)
try {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const envPath = resolve(__dirname, "../../winmoz/.env.local");
  const lines = readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    const [, k, v] = m;
    if (!process.env[k]) process.env[k] = v;
    if (k === "VITE_SUPABASE_SERVICE_ROLE" && !process.env["SUPABASE_SERVICE_ROLE_KEY"]) {
      process.env["SUPABASE_SERVICE_ROLE_KEY"] = v;
    }
    if (k === "VITE_SUPABASE_URL" && !process.env["SUPABASE_URL"]) {
      process.env["SUPABASE_URL"] = v;
    }
  }
} catch { /* .env.local not present in production – env vars come from host */ }

import app from "./app";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
