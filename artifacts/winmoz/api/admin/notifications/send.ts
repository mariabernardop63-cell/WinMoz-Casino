import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  const supabaseUrl = process.env["SUPABASE_URL"];
  const serviceKey  = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !serviceKey) {
    res.status(500).json({ error: "Faltam variáveis SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no servidor." });
    return;
  }

  const { title, subtitle, type, target, targetUserIds, imageUrl, actionButtonLabel, actionButtonUrl, sentBy } =
    req.body as {
      title?: string;
      subtitle?: string;
      type?: string;
      target?: string;
      targetUserIds?: string[];
      imageUrl?: string;
      actionButtonLabel?: string;
      actionButtonUrl?: string;
      sentBy?: string;
    };

  if (!title?.trim()) {
    res.status(400).json({ error: "O campo 'title' é obrigatório." });
    return;
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error } = await admin.from("notifications").insert({
    title:               title.trim(),
    subtitle:            subtitle ?? null,
    type:                type ?? "notification",
    target:              target ?? "all",
    target_user_ids:     targetUserIds ?? null,
    image_url:           imageUrl ?? null,
    action_button_label: actionButtonLabel ?? null,
    action_button_url:   actionButtonUrl ?? null,
    sent_by:             sentBy ?? null,
  });

  if (error) {
    console.error("[notifications/send] Supabase error:", error.message);
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(200).json({ ok: true });
}
