import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authenticateAdmin, getSupabaseAdmin, setCorsHeaders } from "../../_lib/auth";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  const auth = await authenticateAdmin(req);
  if (!auth) { res.status(403).json({ error: "Acesso negado" }); return; }

  const { userId, userName, content } = req.body as {
    userId?: string;
    userName?: string;
    content?: string;
  };

  if (!userId || !content?.trim()) {
    res.status(400).json({ error: "userId e content são obrigatórios" });
    return;
  }

  try {
    const admin = getSupabaseAdmin();
    const { error } = await admin.from("support_messages").insert({
      user_id:    userId,
      user_name:  userName ?? "Admin",
      sender:     "admin",
      content:    content.trim(),
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error("[support/send] insert error:", error);
      res.status(500).json({ error: error.message });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[support/send] unexpected:", err);
    res.status(500).json({ error: "Erro interno" });
  }
}
