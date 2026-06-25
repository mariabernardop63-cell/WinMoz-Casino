import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authenticateAdmin, getSupabaseAdmin, setCorsHeaders } from "../../_lib/auth";

const ALLOWED_KEYS = new Set([
  "maintenance_mode",
  "admin_security_password",
  "min_bet",
  "max_bet",
  "min_withdrawal",
  "max_withdrawal",
  "withdrawal_fee",
  "referral_bonus",
  "platform_name",
  "revenue_reset_at",
  "saidas_reset_at",
  "ludo_enabled",
  "damas_enabled",
  "xadrez_enabled",
  "roleta_enabled",
]);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  const auth = await authenticateAdmin(req);
  if (!auth) { res.status(403).json({ error: "Acesso negado" }); return; }

  const { key, value } = req.body as { key?: string; value?: string };
  if (!key) { res.status(400).json({ error: "key obrigatório" }); return; }
  if (value === undefined || value === null) { res.status(400).json({ error: "value obrigatório" }); return; }

  if (!ALLOWED_KEYS.has(key)) {
    res.status(400).json({ error: "Chave não permitida" });
    return;
  }

  try {
    const admin = getSupabaseAdmin();
    const { error } = await admin
      .from("platform_settings")
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });

    if (error) { res.status(500).json({ error: error.message }); return; }
    res.status(200).json({ ok: true });
  } catch {
    res.status(500).json({ error: "Erro interno" });
  }
}
