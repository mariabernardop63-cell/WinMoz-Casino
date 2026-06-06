import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (_req.method === "OPTIONS") { res.status(200).end(); return; }

  // read_by_admin column does not exist in the table schema.
  // This endpoint is a no-op — returns ok so the frontend doesn't break.
  res.status(200).json({ ok: true });
}
