import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authenticateAdmin, getSupabaseAdmin, setCorsHeaders } from "./_lib/auth";

// ─── Settings key allowlists ────────────────────────────────────────────────
const PUBLIC_KEYS = new Set([
  "maintenance_mode", "platform_name", "min_bet", "max_bet",
  "ludo_enabled", "damas_enabled", "xadrez_enabled", "roleta_enabled",
]);
const ADMIN_ONLY_KEYS = new Set([
  "admin_security_password", "revenue_reset_at", "saidas_reset_at",
  "min_withdrawal", "max_withdrawal", "withdrawal_fee", "referral_bonus",
]);
const WRITE_ALLOWED_KEYS = new Set([
  "maintenance_mode", "admin_security_password", "min_bet", "max_bet",
  "min_withdrawal", "max_withdrawal", "withdrawal_fee", "referral_bonus",
  "platform_name", "revenue_reset_at", "saidas_reset_at",
  "ludo_enabled", "damas_enabled", "xadrez_enabled", "roleta_enabled",
]);

// ─── /api/admin/deposit ──────────────────────────────────────────────────────
async function handleDeposit(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  const auth = await authenticateAdmin(req);
  if (!auth) { res.status(403).json({ error: "Acesso negado" }); return; }

  const { id, action } = req.body as { id?: string; action?: "approve" | "reject" };
  if (!id) { res.status(400).json({ error: "id obrigatório" }); return; }
  if (action !== "approve" && action !== "reject") {
    res.status(400).json({ error: "action deve ser 'approve' ou 'reject'" }); return;
  }

  try {
    const admin = getSupabaseAdmin();
    const { data: txData, error: txErr } = await admin
      .from("transactions").select("id, amount, user_id, type, status").eq("id", id).single();

    if (txErr || !txData) { res.status(404).json({ error: "Pedido não encontrado" }); return; }

    const tx = txData as { id: string; amount: number; user_id: string; type: string; status: string };
    if (tx.status !== "pending") { res.status(400).json({ error: "Pedido já processado" }); return; }

    if (action === "approve") {
      if (["manual_deposit", "manual_bet", "deposit"].includes(tx.type)) {
        const { data: profile } = await admin.from("profiles").select("balance").eq("id", tx.user_id).single();
        const current = Number((profile as { balance: number } | null)?.balance ?? 0);
        const newBalance = Math.round((current + Number(tx.amount)) * 100) / 100;
        const { error: balErr } = await admin.from("profiles").update({ balance: newBalance }).eq("id", tx.user_id);
        if (balErr) { res.status(500).json({ error: "Erro ao creditar saldo" }); return; }
      }
      const { error: upErr } = await admin.from("transactions").update({ status: "approved" }).eq("id", id);
      if (upErr) { res.status(500).json({ error: "Erro ao aprovar" }); return; }
    } else {
      const { error: upErr } = await admin.from("transactions").update({ status: "rejected" }).eq("id", id);
      if (upErr) { res.status(500).json({ error: "Erro ao rejeitar" }); return; }
    }

    res.status(200).json({ success: true });
  } catch {
    res.status(500).json({ error: "Erro interno" });
  }
}

// ─── /api/admin/settings ─────────────────────────────────────────────────────
async function handleSettings(req: VercelRequest, res: VercelResponse) {
  if (req.method === "GET") {
    const key = req.query["key"] as string | undefined;
    if (!key) { res.status(400).json({ error: "key obrigatório" }); return; }

    if (ADMIN_ONLY_KEYS.has(key)) {
      const auth = await authenticateAdmin(req);
      if (!auth) { res.status(403).json({ error: "Acesso negado" }); return; }
    } else if (!PUBLIC_KEYS.has(key)) {
      res.status(400).json({ error: "Chave não reconhecida" }); return;
    }

    res.setHeader("Cache-Control", "no-store");
    try {
      const admin = getSupabaseAdmin();
      const { data, error } = await admin.from("platform_settings").select("value").eq("key", key).maybeSingle();
      if (error) { res.status(200).json({ setting: null }); return; }
      res.status(200).json({ setting: data ? { value: (data as { value: string }).value } : null });
    } catch {
      res.status(200).json({ setting: null });
    }
    return;
  }

  if (req.method === "POST") {
    const auth = await authenticateAdmin(req);
    if (!auth) { res.status(403).json({ error: "Acesso negado" }); return; }

    const { key, value } = req.body as { key?: string; value?: string };
    if (!key) { res.status(400).json({ error: "key obrigatório" }); return; }
    if (value === undefined || value === null) { res.status(400).json({ error: "value obrigatório" }); return; }
    if (!WRITE_ALLOWED_KEYS.has(key)) { res.status(400).json({ error: "Chave não permitida" }); return; }

    try {
      const admin = getSupabaseAdmin();
      const { error } = await admin.from("platform_settings")
        .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
      if (error) { res.status(500).json({ error: error.message }); return; }
      res.status(200).json({ ok: true });
    } catch {
      res.status(500).json({ error: "Erro interno" });
    }
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}

// ─── /api/admin/verify ───────────────────────────────────────────────────────
async function handleVerify(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST" && req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" }); return;
  }
  res.setHeader("Cache-Control", "no-store, no-cache");
  const auth = await authenticateAdmin(req);
  if (!auth) { res.status(403).json({ isAdmin: false, error: "Acesso negado" }); return; }
  res.json({ isAdmin: true });
}

// ─── Main router ─────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);
  if (req.method === "OPTIONS") { res.status(204).end(); return; }

  const action = (req.query["_action"] as string) || "";

  switch (action) {
    case "deposit":  return handleDeposit(req, res);
    case "settings": return handleSettings(req, res);
    case "verify":   return handleVerify(req, res);
    default:
      res.status(404).json({ error: "Endpoint não encontrado" });
  }
}
