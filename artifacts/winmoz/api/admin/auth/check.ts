import type { VercelRequest, VercelResponse } from "@vercel/node";
import { verifyAdminToken } from "./verify";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Admin-Token");

  if (req.method === "OPTIONS") { res.status(200).end(); return; }

  const token = (req.headers["x-admin-token"] as string | undefined)
    ?? (req.body as Record<string, unknown>)?.token as string | undefined
    ?? "";

  if (!token || typeof token !== "string") {
    return res.status(401).json({ ok: false });
  }

  const secret = process.env["ADMIN_JWT_SECRET"]
    ?? process.env["SUPABASE_SERVICE_ROLE_KEY"]
    ?? "";

  if (!secret) return res.status(500).json({ ok: false });

  return res.status(200).json({ ok: verifyAdminToken(secret, token) });
}
