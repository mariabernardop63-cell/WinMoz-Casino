import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authenticateUser, getSupabaseAdmin, setCorsHeaders } from "./_lib/auth";

const MIN_WITHDRAWAL = 50;
const MAX_WITHDRAWAL = 50000;
const WITHDRAWAL_FEE = 5;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  const auth = await authenticateUser(req);
  if (!auth) { res.status(401).json({ error: "Não autenticado" }); return; }

  const { amount, phone } = (req.body ?? {}) as {
    amount?: number;
    phone?: string;
  };

  if (!amount || typeof amount !== "number" || amount < MIN_WITHDRAWAL || amount > MAX_WITHDRAWAL) {
    res.status(400).json({ error: `Montante inválido. Mínimo: ${MIN_WITHDRAWAL} MT, Máximo: ${MAX_WITHDRAWAL} MT` });
    return;
  }

  const cleanPhone = String(phone ?? "").replace(/\D/g, "");
  if (cleanPhone.length < 9) {
    res.status(400).json({ error: "Número de telefone inválido" });
    return;
  }

  const totalDeduction = amount + WITHDRAWAL_FEE;
  const admin = getSupabaseAdmin();

  // Blocked status
  const { data: blockedRow } = await admin
    .from("profiles")
    .select("is_blocked, full_name, bonus_balance, balance")
    .eq("id", auth.userId)
    .single();

  const p = blockedRow as { is_blocked?: boolean; full_name?: string; bonus_balance?: number; balance?: number } | null;
  if (!p) {
    res.status(500).json({ error: "Erro ao carregar perfil" });
    return;
  }
  if (p.is_blocked) {
    res.status(403).json({ error: "Conta bloqueada" });
    return;
  }

  // ── WELCOME BONUS CHECK ──────────────────────────────────────────────────
  // If the user has bonus_balance > 0, they must have placed at least one bet
  // before they can withdraw. This prevents bonus abuse.
  const bonusBalance = Number(p.bonus_balance ?? 0);
  if (bonusBalance > 0) {
    const { count: betCount } = await admin
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", auth.userId)
      .eq("type", "bet")
      .limit(1);

    if ((betCount ?? 0) === 0) {
      res.status(400).json({
        error: "Bónus de boas-vindas bloqueado para levantamento",
        code: "BONUS_LOCKED",
        message: "Para levantar o teu bónus de boas-vindas de 10 MT, precisas fazer pelo menos uma aposta. Faz uma aposta e depois podes levantar normalmente!",
      });
      return;
    }

    // User has placed a bet — unlock the bonus for withdrawal
    await admin
      .from("profiles")
      .update({ bonus_balance: 0 })
      .eq("id", auth.userId);
  }

  // SECURITY (auditoria v2): dedução ATÓMICA via RPC — o saldo é decrementado
  // no próprio UPDATE com guard de suficiência. Elimina double-spend de
  // levantamentos concorrentes e a perda de créditos concorrentes.
  const { data: balanceRow, error: adjustError } = await admin
    .rpc("adjust_balance", { p_user_id: auth.userId, p_delta: -totalDeduction, p_min: 0 });

  if (adjustError) {
    console.error("[withdraw] Erro ao debitar saldo:", adjustError);
    res.status(500).json({ error: "Erro ao debitar saldo" });
    return;
  }
  const newBalance = balanceRow === null || balanceRow === undefined ? null : Number(balanceRow);
  if (newBalance === null) {
    res.status(400).json({ error: `Saldo insuficiente. Necessário: ${totalDeduction} MT (${amount} + ${WITHDRAWAL_FEE} MT taxa)` });
    return;
  }

  // Create pending withdrawal transaction
  const { data: txRow, error: txError } = await admin
    .from("transactions")
    .insert({
      user_id: auth.userId,
      type: "withdrawal",
      amount: -Math.abs(totalDeduction),
      description: JSON.stringify({
        method: "M-Pesa",
        phone: `258${cleanPhone.replace(/^258/, "")}`,
        userName: p.full_name ?? "utilizador",
        fee: WITHDRAWAL_FEE,
        requestedAmount: amount,
      }),
      status: "pending",
      created_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (txError || !txRow) {
    // Refund balance atomically if transaction insert fails
    await admin
      .rpc("adjust_balance", { p_user_id: auth.userId, p_delta: totalDeduction, p_min: 0 });

    res.status(500).json({ error: "Erro ao registar levantamento. Tenta novamente." });
    return;
  }

  res.json({
    success: true,
    withdrawalId: (txRow as { id: string }).id,
    newBalance,
  });
}
