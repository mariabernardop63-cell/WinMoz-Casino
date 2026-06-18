import type { VercelRequest, VercelResponse } from "@vercel/node";
import { randomBytes, createHmac } from "crypto";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  const authHeader = req.headers.authorization ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key) return res.status(500).json({ error: "Server misconfigured" });

  const body = req.body as Record<string, unknown>;
  const gameId = body["gameId"];
  const turn = body["turn"];

  if (
    typeof gameId !== "string" || gameId.length === 0 || gameId.length > 120 ||
    (turn !== undefined && typeof turn !== "number")
  ) {
    return res.status(400).json({ error: "Missing gameId" });
  }

  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: { user }, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !user) return res.status(401).json({ error: "Sessão inválida" });

  const buf = randomBytes(4);
  const raw = buf.readUInt32BE(0);
  const value = (raw % 6) + 1;

  const nonce = randomBytes(16).toString("hex");
  const ts = Date.now().toString();

  const secret = key;
  const sig = createHmac("sha256", secret)
    .update(`${gameId}:${turn ?? 0}:${value}:${nonce}:${ts}`)
    .digest("hex")
    .slice(0, 32);

  return res.status(200).json({ value, nonce, sig, ts });
}
