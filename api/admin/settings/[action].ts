import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") { res.status(200).end(); return; }

  const action = req.query["action"] as string;
  if (action !== "get" && action !== "set") {
    res.status(404).json({ error: "Not found" }); return;
  }

  const supabaseUrl = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"] ?? "";
  const supabaseServiceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? process.env["VITE_SUPABASE_SERVICE_ROLE"] ?? "";

  if (!supabaseUrl || !supabaseServiceKey) {
    if (action === "set") {
      console.error("settings/set: missing env vars SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
      res.status(500).json({ error: "Serviço indisponível — variáveis de ambiente em falta" }); return;
    }
    res.status(200).json({ setting: null }); return;
  }

  try {
    const admin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    if (action === "get") {
      if (req.method !== "GET") { res.status(405).json({ error: "Method not allowed" }); return; }
      const key = req.query["key"] as string | undefined;
      if (!key) { res.status(400).json({ error: "key required" }); return; }

      const { data, error } = await admin
        .from("platform_settings").select("value").eq("key", key).maybeSingle();

      if (error) { res.status(200).json({ setting: null }); return; }
      res.status(200).json({ setting: data ? { value: data.value } : null });

    } else {
      if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }
      const { key, value } = (req.body ?? {}) as { key?: string; value?: string };
      if (!key) { res.status(400).json({ error: "key required" }); return; }
      if (value === undefined || value === null) { res.status(400).json({ error: "value required" }); return; }

      const { error } = await admin
        .from("platform_settings").upsert({ key, value }, { onConflict: "key" });

      if (error) { res.status(500).json({ error: error.message }); return; }
      res.status(200).json({ ok: true });
    }
  } catch (err) {
    console.error(`settings/${action} error:`, err);
    res.status(500).json({ error: "Erro interno" });
  }
}
