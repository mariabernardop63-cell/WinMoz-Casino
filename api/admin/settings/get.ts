import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseAdmin, setCorsHeaders } from "../../_lib/auth";

const PUBLIC_KEYS = new Set([
  "maintenance_mode",
  "platform_name",
  "min_bet",
  "max_bet",
  "ludo_enabled",
  "damas_enabled",
  "xadrez_enabled",
  "roleta_enabled",
]);

const ADMIN_ONLY_KEYS = new Set([
  "admin_security_password",
  "revenue_reset_at",
  "saidas_reset_at",
  "min_withdrawal",
  "max_withdrawal",
  "withdrawal_fee",
  "referral_bonus",
]);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "GET") { res.status(405).json({ error: "Method not allowed" }); return; }

  const key = req.query["key"] as string | undefined;
  if (!key) { res.status(400).json({ error: "key obrigatório" }); return; }

  if (ADMIN_ONLY_KEYS.has(key)) {
    const { authenticateAdmin } = await import("../../_lib/auth");
    const auth = await authenticateAdmin(req);
    if (!auth) { res.status(403).json({ error: "Acesso negado" }); return; }
  } else if (!PUBLIC_KEYS.has(key)) {
    res.status(400).json({ error: "Chave não reconhecida" });
    return;
  }

  res.setHeader("Cache-Control", "no-store");

  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("platform_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle();

    if (error) { res.status(200).json({ setting: null }); return; }
    res.status(200).json({ setting: data ? { value: (data as { value: string }).value } : null });
  } catch {
    res.status(200).json({ setting: null });
  }
}
