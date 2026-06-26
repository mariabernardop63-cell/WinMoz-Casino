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

// ─── Main router ─────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);
  if (req.method === "OPTIONS") { res.status(204).end(); return; }

  const action = (req.query["_action"] as string) || "";

  switch (action) {
    case "deposit":                    return handleDeposit(req, res);
    case "settings":                   return handleSettings(req, res);
    case "verify":                     return handleVerify(req, res);
    case "notifications/send":         return handleNotificationsSend(req, res);
    case "notifications/history":      return handleNotificationsHistory(req, res);
    case "support/send":               return handleSupportSend(req, res);
    case "support/conversations":      return handleSupportConversations(req, res);
    default:
      res.status(404).json({ error: "Endpoint não encontrado" });
  }
}
