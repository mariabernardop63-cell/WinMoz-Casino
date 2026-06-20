import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const code = ((req.query["code"] as string) ?? "").toUpperCase().trim();

  if (!code || !/^[A-Z0-9]{4,10}$/.test(code)) {
    return res.status(200).json({ valid: false, reason: "format" });
  }

  const supabaseUrl = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"] ?? "";
  const serviceKey =
    process.env["SUPABASE_SERVICE_ROLE_KEY"] ??
    process.env["VITE_SUPABASE_SERVICE_ROLE"] ??
    process.env["VITE_SUPABASE_SERVICE_ROLE_KEY"] ??
    "";

  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ valid: false, reason: "env_missing" });
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const { data: byGeneral } = await admin
      .from("profiles")
      .select("id")
      .eq("my_invite_code", code)
      .maybeSingle();

    if (byGeneral) {
      return res.status(200).json({ valid: true, type: "general" });
    }

    const { data: byAffiliate, error } = await admin
      .from("profiles")
      .select("id")
      .eq("affiliate_invite_code", code)
      .maybeSingle();

    if (error) {
      return res.status(500).json({ valid: false, reason: "db_error" });
    }

    return res.status(200).json({ valid: !!byAffiliate, type: byAffiliate ? "affiliate" : null });
  } catch (err) {
    console.error("[validate-invite] error:", err);
    return res.status(500).json({ valid: false, reason: "exception" });
  }
}
