import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authenticateAdmin, getSupabaseAdmin, setCorsHeaders } from "./_lib/auth";
import { randomInt } from "crypto";

// ─── Settings key allowlists ────────────────────────────────────────────────
const PUBLIC_KEYS = new Set([
  "maintenance_mode", "platform_name", "min_bet", "max_bet",
  "ludo_enabled", "damas_enabled", "xadrez_enabled", "roleta_enabled",
  "poker_winner_mode", "whatsapp_group_url", "recharge_whatsapp_contact",
  "mpesa_wallet_enabled", "emola_wallet_enabled",
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
  "poker_winner_mode", "support_ai_mode", "allow_new_users", "bets_active",
  "backup_auto", "query_cache", "query_logs",
  "mpesa_wallet_enabled", "emola_wallet_enabled",
  "app_version", "terms_of_service_content", "privacy_policy_content",
  "ad_banner_script", "footer_tagline", "footer_phone", "footer_email",
  "footer_app_download_url", "whatsapp_group_url", "recharge_whatsapp_contact",
  "sms_mpesa_number", "sms_mpesa_name", "sms_emola_number", "sms_emola_name",
  "sms_webhook_token",
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

// ─── /api/admin/security-password ────────────────────────────────────────────
async function handleSecurityPassword(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") { res.status(405).json({ error: "Method not allowed" }); return; }
  const auth = await authenticateAdmin(req);
  if (!auth) { res.status(403).json({ error: "Acesso negado" }); return; }
  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("platform_settings")
      .select("value")
      .eq("key", "admin_security_password")
      .maybeSingle();
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.status(200).json({ password: (data as { value?: string } | null)?.value ?? null });
  } catch {
    res.status(500).json({ error: "Erro interno" });
  }
}

// ─── /api/admin/update-admin-credentials ──────────────────────────────────────
async function handleUpdateAdminCredentials(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }
  const auth = await authenticateAdmin(req);
  if (!auth) { res.status(403).json({ error: "Acesso negado" }); return; }
  const { type, value, adminEmail } = req.body as {
    type?: "email" | "password";
    value?: string;
    adminEmail?: string;
  };
  if (!type || !value || !adminEmail) {
    res.status(400).json({ error: "Parâmetros em falta (type, value, adminEmail)" });
    return;
  }
  if (type !== "email" && type !== "password") {
    res.status(400).json({ error: "Tipo inválido" });
    return;
  }
  try {
    const admin = getSupabaseAdmin();
    const { data, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 });
    if (listError) { res.status(500).json({ error: "Erro ao procurar utilizador: " + listError.message }); return; }
    const user = data.users.find((candidate) =>
      candidate.email?.toLowerCase() === adminEmail.trim().toLowerCase()
    );
    if (!user) { res.status(404).json({ error: "Nenhuma conta encontrada com esse e-mail" }); return; }
    const update = type === "email" ? { email: value.trim() } : { password: value };
    const { error: updateError } = await admin.auth.admin.updateUserById(user.id, update);
    if (updateError) { res.status(500).json({ error: "Erro ao actualizar: " + updateError.message }); return; }
    res.status(200).json({ ok: true });
  } catch {
    res.status(500).json({ error: "Erro interno" });
  }
}

// ─── /api/admin/notifications/send ───────────────────────────────────────────
async function handleNotificationsSend(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  const auth = await authenticateAdmin(req);
  if (!auth) { res.status(403).json({ error: "Acesso negado" }); return; }

  const {
    title, subtitle, type, target,
    targetUserIds, imageUrl, actionButtonLabel, actionButtonUrl, sentBy,
  } = req.body as {
    title?: string; subtitle?: string; type?: string; target?: string;
    targetUserIds?: string[] | null; imageUrl?: string | null;
    actionButtonLabel?: string | null; actionButtonUrl?: string | null; sentBy?: string | null;
  };

  if (!title?.trim()) { res.status(400).json({ error: "title obrigatório" }); return; }

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
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.status(200).json({ ok: true });
  } catch {
    res.status(500).json({ error: "Erro interno" });
  }
}

// ─── /api/admin/notifications/history ────────────────────────────────────────
async function handleNotificationsHistory(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") { res.status(405).json({ error: "Method not allowed" }); return; }

  const auth = await authenticateAdmin(req);
  if (!auth) { res.status(403).json({ error: "Acesso negado" }); return; }

  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json(data ?? []);
  } catch {
    res.status(500).json({ error: "Erro interno" });
  }
}

// ─── /api/admin/support/send ──────────────────────────────────────────────────
async function handleSupportSend(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  const auth = await authenticateAdmin(req);
  if (!auth) { res.status(403).json({ error: "Acesso negado" }); return; }

  const { userId, userName, content } = req.body as {
    userId?: string; userName?: string; content?: string;
  };
  if (!userId || !content?.trim()) {
    res.status(400).json({ error: "userId e content são obrigatórios" }); return;
  }

  try {
    const admin = getSupabaseAdmin();
    const { error } = await admin.from("support_messages").insert({
      user_id:    userId,
      user_name:  userName ?? "Admin",
      sender:     "admin",
      content:    content.trim(),
      created_at: new Date().toISOString(),
    });
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.status(200).json({ ok: true });
  } catch {
    res.status(500).json({ error: "Erro interno" });
  }
}

// ─── /api/admin/support/conversations ────────────────────────────────────────
async function handleSupportConversations(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") { res.status(405).json({ error: "Method not allowed" }); return; }

  const auth = await authenticateAdmin(req);
  if (!auth) { res.status(403).json({ error: "Acesso negado" }); return; }

  const userId = req.query["userId"] as string | undefined;
  const admin = getSupabaseAdmin();

  try {
    if (userId) {
      const { data, error } = await admin
        .from("support_messages")
        .select("id, user_id, user_name, sender, content, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: true });
      if (error) { res.status(500).json({ error: error.message }); return; }
      res.setHeader("Cache-Control", "no-store");
      res.status(200).json(data ?? []);
      return;
    }

    const { data, error } = await admin
      .from("support_messages")
      .select("user_id, user_name, sender, content, created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) { res.status(500).json({ error: error.message }); return; }

    const msgs = data ?? [];
    const userIds = Array.from(new Set(msgs.map((m: Record<string, unknown>) => m.user_id as string)));
    let profileMap: Record<string, string | null> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await admin
        .from("profiles").select("id, avatar_url").in("id", userIds);
      (profiles ?? []).forEach((p: Record<string, unknown>) => {
        profileMap[p.id as string] = (p.avatar_url as string) ?? null;
      });
    }

    const lastAdminReply = new Map<string, string>();
    msgs.forEach((m: Record<string, unknown>) => {
      const uid = m.user_id as string;
      if ((m.sender === "admin" || m.sender === "ai") && !lastAdminReply.has(uid)) {
        lastAdminReply.set(uid, m.created_at as string);
      }
    });

    const convMap = new Map<string, Record<string, unknown>>();
    msgs.forEach((m: Record<string, unknown>) => {
      const uid = m.user_id as string;
      if (!convMap.has(uid)) {
        convMap.set(uid, {
          userId:          uid,
          userName:        (m.user_name as string) ?? "utilizador",
          avatarUrl:       profileMap[uid] ?? null,
          lastMessage:     (m.content as string) ?? "",
          lastMessageTime: m.created_at as string,
          unreadCount:     0,
          lastSender:      (m.sender as string) ?? "user",
        });
      }
      if (m.sender === "user") {
        const lastReply = lastAdminReply.get(uid);
        const isUnread = !lastReply || new Date(m.created_at as string) > new Date(lastReply);
        if (isUnread) {
          const conv = convMap.get(uid)!;
          (conv.unreadCount as number);
          conv.unreadCount = (conv.unreadCount as number) + 1;
        }
      }
    });

    const result = Array.from(convMap.values()).sort(
      (a, b) => new Date(b.lastMessageTime as string).getTime() - new Date(a.lastMessageTime as string).getTime()
    );

    res.setHeader("Cache-Control", "no-store");
    res.status(200).json(result);
  } catch {
    res.status(500).json({ error: "Erro interno" });
  }
}

// ─── Recharge codes: shared helpers ─────────────────────────────────────────
const RECHARGE_CODE_LENGTH = 12;
const RECHARGE_MAX_BATCH = 200;
const RECHARGE_MAX_USES = 1000;
const RECHARGE_MAX_AMOUNT = 100000;

/** Gera um código de 12 dígitos (só números) com aleatoriedade criptográfica */
function generateRechargeCode(): string {
  let code = "";
  for (let i = 0; i < RECHARGE_CODE_LENGTH; i++) code += String(randomInt(0, 10));
  return code;
}

/** Estado efectivo de um código (considera validade temporal) */
function effectiveStatus(c: { status: string; expires_at: string | null }): string {
  if (c.status === "active" && c.expires_at && new Date(c.expires_at).getTime() < Date.now()) {
    return "expired";
  }
  return c.status;
}

// ─── /api/admin/recharge/list ────────────────────────────────────────────────
async function handleRechargeList(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") { res.status(405).json({ error: "Method not allowed" }); return; }

  const auth = await authenticateAdmin(req);
  if (!auth) { res.status(403).json({ error: "Acesso negado" }); return; }

  const page = Math.max(1, parseInt(String(req.query["page"] ?? "1"), 10) || 1);
  const limit = Math.min(100, Math.max(5, parseInt(String(req.query["limit"] ?? "20"), 10) || 20));
  const status = String(req.query["status"] ?? "all");      // all | active | expired | revoked
  const search = String(req.query["search"] ?? "").replace(/\D/g, "").slice(0, RECHARGE_CODE_LENGTH);

  try {
    const admin = getSupabaseAdmin();

    let query = admin
      .from("recharge_codes")
      .select("id, code, amount, max_uses, used_count, status, created_by, expires_at, used_at, last_used_by, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (search.length === RECHARGE_CODE_LENGTH) query = query.eq("code", search);
    else if (search.length > 0) query = query.like("code", `${search}%`);

    const { data, error, count } = await query;
    if (error) { res.status(500).json({ error: error.message }); return; }

    let rows = (data ?? []) as Array<{
      id: string; code: string; amount: number; max_uses: number; used_count: number;
      status: string; expires_at: string | null; used_at: string | null; created_at: string;
      last_used_by: string | null;
    }>;

    // Filtro de estado (inclui expiração temporal calculada)
    if (status !== "all") {
      rows = rows.filter((r) => effectiveStatus(r) === status);
    }

    // Usos (quem resgatou) para os códigos da página
    const ids = rows.map((r) => r.id);
    const redemptionsByCode: Record<string, Array<{ userId: string; userName: string; amount: number; createdAt: string }>> = {};
    if (ids.length > 0) {
      const { data: redData, error: redErr } = await admin
        .from("recharge_redemptions")
        .select("code_id, user_id, amount, created_at, profiles:user_id(full_name)")
        .in("code_id", ids)
        .order("created_at", { ascending: true });
      if (redErr) {
        console.error("[recharge/list] redemptions query failed:", redErr.message);
      }
      for (const rd of (redData ?? []) as Array<Record<string, unknown>>) {
        const cid = rd.code_id as string;
        const prof = (rd.profiles ?? {}) as { full_name?: string };
        (redemptionsByCode[cid] ??= []).push({
          userId: rd.user_id as string,
          userName: prof.full_name ?? "utilizador",
          amount: Number(rd.amount ?? 0),
          createdAt: rd.created_at as string,
        });
      }
    }

    // Estatísticas globais (em paralelo, limitadas)
    const [allCodes, redeemAgg] = await Promise.all([
      admin.from("recharge_codes").select("status, amount, max_uses, used_count, expires_at").limit(10000),
      admin.from("transactions").select("amount").eq("type", "recharge").eq("status", "approved").limit(10000),
    ]);
    if (allCodes.error) {
      res.status(500).json({ error: "recharge_codes: " + allCodes.error.message }); return;
    }
    const all = (allCodes.data ?? []) as Array<{ status: string; amount: number; max_uses: number; used_count: number; expires_at: string | null }>;
    const stats = {
      total: all.length,
      active: 0, expired: 0, revoked: 0,
      totalValueActive: 0,
      remainingUsesActive: 0,
      redeemedTotal: 0,
      redeemedCount: 0,
    };
    for (const c of all) {
      const st = effectiveStatus(c);
      if (st === "active") { stats.active++; stats.totalValueActive += Number(c.amount); stats.remainingUsesActive += (c.max_uses - c.used_count) * Number(c.amount); }
      else if (st === "expired") stats.expired++;
      else if (st === "revoked") stats.revoked++;
    }
    const reTx = (redeemAgg.data ?? []) as Array<{ amount: number }>;
    stats.redeemedTotal = reTx.reduce((s, t) => s + Number(t.amount ?? 0), 0);
    stats.redeemedCount = reTx.length;

    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({
      items: rows.map((r) => ({ ...r, effectiveStatus: effectiveStatus(r), redemptions: redemptionsByCode[r.id] ?? [] })),
      total: count ?? rows.length,
      page,
      limit,
      stats,
    });
  } catch {
    res.status(500).json({ error: "Erro interno" });
  }
}

// ─── /api/admin/recharge/create ──────────────────────────────────────────────
async function handleRechargeCreate(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  const auth = await authenticateAdmin(req);
  if (!auth) { res.status(403).json({ error: "Acesso negado" }); return; }

  const body = (req.body ?? {}) as {
    amount?: number; maxUses?: number; quantity?: number; expiresInDays?: number | null; note?: string | null;
  };

  const amount = Number(body.amount);
  const maxUses = Math.floor(Number(body.maxUses ?? 1));
  const quantity = Math.floor(Number(body.quantity ?? 1));
  const expiresInDays = body.expiresInDays == null ? null : Math.floor(Number(body.expiresInDays));
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 200) : null;

  if (!Number.isFinite(amount) || amount <= 0 || amount > RECHARGE_MAX_AMOUNT) {
    res.status(400).json({ error: `Valor deve estar entre 1 e ${RECHARGE_MAX_AMOUNT} MZN` }); return;
  }
  if (!Number.isFinite(maxUses) || maxUses < 1 || maxUses > RECHARGE_MAX_USES) {
    res.status(400).json({ error: `Usos máximos deve estar entre 1 e ${RECHARGE_MAX_USES}` }); return;
  }
  if (!Number.isFinite(quantity) || quantity < 1 || quantity > RECHARGE_MAX_BATCH) {
    res.status(400).json({ error: `Quantidade deve estar entre 1 e ${RECHARGE_MAX_BATCH}` }); return;
  }
  if (expiresInDays != null && (!Number.isFinite(expiresInDays) || expiresInDays < 1 || expiresInDays > 3650)) {
    res.status(400).json({ error: "Validade deve estar entre 1 e 3650 dias" }); return;
  }

  try {
    const admin = getSupabaseAdmin();

    // Pré-checagem: tabela existe e é a nova versão (tem coluna max_uses)
    const { error: probeError } = await admin.from("recharge_codes").select("max_uses").limit(1);
    if (probeError) {
      res.status(500).json({
        error: "Tabela recharge_codes não está actualizada. Executa supabase-recharge-system.sql no Supabase SQL Editor. (" + probeError.message + ")",
      });
      return;
    }

    const createdAt = new Date().toISOString();
    const expiresAt = expiresInDays ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString() : null;

    const created: Array<{ code: string; id: string }> = [];
    let attempts = 0;

    while (created.length < quantity && attempts < quantity * 10 + 20) {
      attempts++;
      const need = quantity - created.length;
      const batch = new Set<string>();
      while (batch.size < need) batch.add(generateRechargeCode());
      const candidates = Array.from(batch);

      // Colisões com a base de dados
      const { data: existing } = await admin
        .from("recharge_codes")
        .select("code")
        .in("code", candidates);
      const taken = new Set((existing ?? []).map((e: { code: string }) => e.code));
      const fresh = candidates.filter((c) => !taken.has(c));
      if (fresh.length === 0) continue;

      const rows = fresh.map((code) => ({
        code, amount, max_uses: maxUses, used_count: 0, status: "active",
        created_by: auth.userId, expires_at: expiresAt, created_at: createdAt,
      }));

      const { data: inserted, error: insertError } = await admin
        .from("recharge_codes")
        .insert(rows)
        .select("id, code");

      if (insertError) {
        // Colisão rara de UNIQUE — tenta novo lote
        if (insertError.code === "23505") continue;
        res.status(500).json({ error: insertError.message }); return;
      }
      for (const r of (inserted ?? []) as Array<{ id: string; code: string }>) created.push(r);
    }

    if (created.length < quantity) {
      res.status(500).json({ error: "Não foi possível gerar todos os códigos. Tenta novamente." }); return;
    }

    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({ ok: true, created });
  } catch {
    res.status(500).json({ error: "Erro interno" });
  }
}

// ─── /api/admin/recharge/delete ──────────────────────────────────────────────
async function handleRechargeDelete(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  const auth = await authenticateAdmin(req);
  if (!auth) { res.status(403).json({ error: "Acesso negado" }); return; }

  const { id } = (req.body ?? {}) as { id?: string };
  if (!id) { res.status(400).json({ error: "id obrigatório" }); return; }

  try {
    const admin = getSupabaseAdmin();
    // Elimina o código — os usos (recharge_redemptions) são removidos em cascata;
    // o histórico financeiro fica intacto na tabela transactions.
    const { error } = await admin.from("recharge_codes").delete().eq("id", id);
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.status(200).json({ ok: true });
  } catch {
    res.status(500).json({ error: "Erro interno" });
  }
}

// ─── /api/admin/recharge/toggle ──────────────────────────────────────────────
async function handleRechargeToggle(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  const auth = await authenticateAdmin(req);
  if (!auth) { res.status(403).json({ error: "Acesso negado" }); return; }

  const { id, action } = (req.body ?? {}) as { id?: string; action?: "disable" | "enable" };
  if (!id || (action !== "disable" && action !== "enable")) {
    res.status(400).json({ error: "id e action ('disable'|'enable') obrigatórios" }); return;
  }

  try {
    const admin = getSupabaseAdmin();
    const { data: row } = await admin
      .from("recharge_codes")
      .select("id, status, used_count, max_uses, expires_at")
      .eq("id", id)
      .single();

    const c = row as { id: string; status: string; used_count: number; max_uses: number; expires_at: string | null } | null;
    if (!c) { res.status(404).json({ error: "Código não encontrado" }); return; }

    if (action === "disable") {
      const { error } = await admin.from("recharge_codes").update({ status: "revoked" }).eq("id", id);
      if (error) { res.status(500).json({ error: error.message }); return; }
    } else {
      // Re-activar apenas se não estiver esgotado nem fora da validade
      if (c.used_count >= c.max_uses) { res.status(400).json({ error: "Código já esgotado — não pode ser reactivado" }); return; }
      if (c.expires_at && new Date(c.expires_at).getTime() < Date.now()) {
        res.status(400).json({ error: "Código fora da validade — não pode ser reactivado" }); return;
      }
      const { error } = await admin.from("recharge_codes").update({ status: "active" }).eq("id", id);
      if (error) { res.status(500).json({ error: error.message }); return; }
    }

    res.status(200).json({ ok: true });
  } catch {
    res.status(500).json({ error: "Erro interno" });
  }
}

// ─── Main router ─────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);
  if (req.method === "OPTIONS") { res.status(204).end(); return; }

  const action = (req.query["_action"] as string) || "";

  switch (action) {
    case "deposit":                    return handleDeposit(req, res);
    case "settings":
    case "settings/get":
    case "settings/set":
    case "settings/update":             return handleSettings(req, res);
    case "verify":                     return handleVerify(req, res);
    case "security-password":           return handleSecurityPassword(req, res);
    case "update-admin-credentials":    return handleUpdateAdminCredentials(req, res);
    case "notifications/send":         return handleNotificationsSend(req, res);
    case "notifications/history":      return handleNotificationsHistory(req, res);
    case "support/send":               return handleSupportSend(req, res);
    case "support/conversations":      return handleSupportConversations(req, res);
    case "recharge/list":              return handleRechargeList(req, res);
    case "recharge/create":            return handleRechargeCreate(req, res);
    case "recharge/delete":            return handleRechargeDelete(req, res);
    case "recharge/toggle":            return handleRechargeToggle(req, res);
    default:
      res.status(404).json({ error: "Endpoint não encontrado" });
  }
}
