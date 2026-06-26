import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authenticateAdmin, getSupabaseAdmin, setCorsHeaders } from "../../_lib/auth";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  const auth = await authenticateAdmin(req);
  if (!auth) { res.status(403).json({ error: "Acesso negado" }); return; }

  const {
    title,
    subtitle,
    type,
    target,
    targetUserIds,
    imageUrl,
    actionButtonLabel,
    actionButtonUrl,
    sentBy,
  } = req.body as {
    title?: string;
    subtitle?: string;
    type?: string;
    target?: string;
    targetUserIds?: string[] | null;
    imageUrl?: string | null;
    actionButtonLabel?: string | null;
    actionButtonUrl?: string | null;
    sentBy?: string | null;
  };

  if (!title?.trim()) {
    res.status(400).json({ error: "title obrigatório" });
    return;
  }

  try {
    const admin = getSupabaseAdmin();
    const { error } = await admin.from("notifications").insert({
      title:               title.trim(),
      subtitle:            subtitle?.trim() ?? null,
      type:                type ?? "notification",
      target:              target ?? "all",
      target_user_ids:     targetUserIds ?? null,
      image_url:           imageUrl ?? null,
      action_button_label: actionButtonLabel ?? null,
      action_button_url:   actionButtonUrl ?? null,
      sent_by:             sentBy ?? auth.userId,
      created_at:          new Date().toISOString(),
    });

    if (error) {
      console.error("[notifications/send] insert error:", error);
      res.status(500).json({ error: error.message });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[notifications/send] unexpected:", err);
    res.status(500).json({ error: "Erro interno" });
  }
}
