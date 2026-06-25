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

  // Check balance and blocked status
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("balance, is_blocked, full_name")
    .eq("id", auth.userId)
    .single();

  if (profileError || !profile) {
    res.status(500).json({ error: "Erro ao carregar perfil" });
    return;
  }

  const p = profile as { balance: number; is_blocked?: boolean; full_name?: string };

  if (p.is_blocked) {
    res.status(403).json({ error: "Conta bloqueada" });
    return;
  }

  const currentBalance = parseFloat(String(p.balance ?? 0));
  if (currentBalance < totalDeduction) {
    res.status(400).json({ error: `Saldo insuficiente. Necessário: ${totalDeduction} MT (${amount} + ${WITHDRAWAL_FEE} MT taxa)` });
    return;
  }

  const newBalance = Math.round((currentBalance - totalDeduction) * 100) / 100;

  // SECURITY: Atomic deduction — only succeeds if balance is still sufficient
  const { data: deducted, error: deductError } = await admin
    .from("profiles")
    .update({ balance: newBalance })
    .eq("id", auth.userId)
    .gte("balance", totalDeduction)
    .select("balance")
    .maybeSingle();

  if (deductError || !deducted) {
    res.status(400).json({ error: "Saldo insuficiente" });
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
    // Refund balance if transaction insert fails
    await admin
      .from("profiles")
      .update({ balance: currentBalance })
      .eq("id", auth.userId);

    res.status(500).json({ error: "Erro ao registar levantamento. Tenta novamente." });
    return;
  }

  res.json({
    success: true,
    withdrawalId: (txRow as { id: string }).id,
    newBalance: (deducted as { balance: number }).balance,
  });
}
