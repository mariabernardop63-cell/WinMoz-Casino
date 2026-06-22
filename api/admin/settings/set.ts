import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  const { key, value } = req.body as { key?: string; value?: string };

  if (!key) { res.status(400).json({ error: "key required" }); return; }
  if (value === undefined || value === null) { res.status(400).json({ error: "value required" }); return; }

  const supabaseUrl = process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"];
  const supabaseServiceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"] || process.env["VITE_SUPABASE_SERVICE_ROLE"] || process.env["VITE_SUPABASE_SERVICE_ROLE_KEY"];

  if (!supabaseUrl || !supabaseServiceKey) {
    res.status(503).json({ error: "Serviço indisponível" });
    return;
  }

  try {
    const admin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: rows } = await admin
      .from("platform_settings")
      .select("id")
      .eq("key", key)
      .limit(1);

    const existing = rows && rows.length > 0 ? rows[0] : null;

    if (existing) {
      const { error } = await admin
        .from("platform_settings")
        .update({ value })
        .eq("key", key);
      if (error) {
        console.error("settings/set update error:", error);
        res.status(500).json({ error: error.message });
        return;
      }
    } else {
      const { error } = await admin
        .from("platform_settings")
        .insert({ key, value });
      if (error) {
        console.error("settings/set insert error:", error);
        res.status(500).json({ error: error.message });
        return;
      }
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("settings/set unexpected error:", err);
    res.status(500).json({ error: "Erro interno" });
  }
}
