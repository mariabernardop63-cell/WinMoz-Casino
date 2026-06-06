import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (req.method !== "GET") { res.status(405).json({ error: "Method not allowed" }); return; }

  const supabaseUrl = process.env["SUPABASE_URL"];
  const serviceKey  = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !serviceKey) {
    res.status(500).json({ error: "Faltam variáveis SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no Vercel." });
    return;
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const settingKey = req.query["key"] as string | undefined;

  if (settingKey) {
    const { data, error } = await admin
      .from("platform_settings")
      .select("key, value")
      .eq("key", settingKey)
      .maybeSingle();
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.status(200).json({ setting: data });
  } else {
    const { data, error } = await admin
      .from("platform_settings")
      .select("key, value");
    if (error) { res.status(500).json({ error: error.message }); return; }
    const map: Record<string, string> = {};
    (data ?? []).forEach((s: { key: string; value: string }) => { map[s.key] = s.value; });
    res.status(200).json({ settings: map });
  }
}
