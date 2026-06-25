import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authenticateAdmin, setCorsHeaders } from "../_lib/auth";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST" && req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  res.setHeader("Cache-Control", "no-store, no-cache");

  const auth = await authenticateAdmin(req);
  if (!auth) {
    res.status(403).json({ isAdmin: false, error: "Acesso negado" });
    return;
  }

  res.json({ isAdmin: true });
}
