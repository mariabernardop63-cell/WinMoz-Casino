import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") { res.status(200).end(); return; }

  const action = req.query["action"] as string;
  if (action !== "send" && action !== "history") {
    res.status(404).json({ error: "Not found" }); return;
  }

  const authHeader = (req.headers.authorization as string) ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) { res.status(401).json({ error: "Unauthorized" }); return; }

  const supabaseUrl = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"] ?? "";
  const supabaseServiceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? process.env["VITE_SUPABASE_SERVICE_ROLE"] ?? "";

  if (!supabaseUrl || !supabaseServiceKey) {
    res.status(500).json({ error: "Serviço indisponível — credenciais em falta" }); return;
  }

  try {
    const admin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Validate the caller is authenticated
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData.user) { res.status(401).json({ error: "Sessão inválida" }); return; }

    // ── SEND ──
    if (action === "send") {
      if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

      const {
        title, subtitle, type, target, targetUserIds,
        imageUrl, actionButtonLabel, actionButtonUrl,
      } = (req.body ?? {}) as {
        title?: string;
        subtitle?: string;
        type?: string;
        target?: string;
        targetUserIds?: string[];
        imageUrl?: string;
        actionButtonLabel?: string;
        actionButtonUrl?: string;
      };

      if (!title?.trim()) { res.status(400).json({ error: "Título obrigatório" }); return; }

      const { error } = await admin.from("notifications").insert({
        title:               title.trim(),
        subtitle:            subtitle?.trim() ?? null,
        type:                type ?? "notification",
        target:              target ?? "all",
        target_user_ids:     targetUserIds ?? null,
        image_url:           imageUrl ?? null,
        action_button_label: actionButtonLabel ?? null,
        action_button_url:   actionButtonUrl ?? null,
        sent_by:             userData.user.id,
        created_at:          new Date().toISOString(),
      });

      if (error) {
        console.error("notifications/send error:", error);
        if (error.code === "42P01") {
          res.status(500).json({ error: "Tabela 'notifications' não existe — aplica a migração SQL no Supabase." });
        } else {
          res.status(500).json({ error: error.message });
        }
        return;
      }

      res.json({ ok: true });

    // ── HISTORY ──
    } else {
      if (req.method !== "GET") { res.status(405).json({ error: "Method not allowed" }); return; }

      const { data, error } = await admin
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        console.error("notifications/history error:", error);
        if (error.code === "42P01") {
          res.json({ data: [], missing_table: true });
        } else {
          res.status(500).json({ error: error.message });
        }
        return;
      }

      res.json({ data: data ?? [] });
    }
  } catch (err) {
    console.error(`notifications/${action} unexpected error:`, err);
    res.status(500).json({ error: "Erro interno" });
  }
}
