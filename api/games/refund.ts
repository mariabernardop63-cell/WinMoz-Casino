import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  const authHeader = (req.headers.authorization as string) ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) { res.status(401).json({ ok: false, error: "Unauthorized" }); return; }

  const { roomCode, amount, gameType } = (req.body ?? {}) as {
    roomCode?: string;
    amount?: number;
    gameType?: string;
  };

  if (!roomCode || !amount || amount <= 0) {
    res.status(400).json({ ok: false, error: "Parâmetros inválidos" });
    return;
  }

  const supabaseUrl = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"] ?? "";
  const supabaseServiceKey =
    process.env["SUPABASE_SERVICE_ROLE_KEY"] ??
    process.env["VITE_SUPABASE_SERVICE_ROLE"] ??
    process.env["VITE_SUPABASE_SERVICE_ROLE_KEY"] ??
    "";
  if (!supabaseUrl || !supabaseServiceKey) {
    res.status(500).json({ ok: false, error: "Serviço indisponível" }); return;
  }

  try {
    const admin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData.user) {
      res.status(401).json({ ok: false, error: "Sessão inválida" }); return;
    }
    const userId = userData.user.id;

    // Idempotency — only refund if a matching bet transaction exists
    const { data: betTx } = await admin
      .from("transactions")
      .select("id")
      .eq("user_id", userId)
      .eq("type", "bet")
      .ilike("description", `%${roomCode}%`)
      .maybeSingle();

    if (!betTx) {
      // No bet found — nothing to refund
      res.json({ ok: true, skipped: true });
      return;
    }

    // Check no refund already exists
    const { data: existingRefund } = await admin
      .from("transactions")
      .select("id")
      .eq("user_id", userId)
      .eq("type", "refund")
      .ilike("description", `%${roomCode}%`)
      .maybeSingle();

    if (existingRefund) {
      res.json({ ok: true, duplicate: true });
      return;
    }

    const { data: profileData, error: profileError } = await admin
      .from("profiles").select("balance").eq("id", userId).single();
    if (profileError || !profileData) {
      res.status(500).json({ ok: false, error: "Erro ao obter saldo" }); return;
    }

    const currentBalance = Math.round(Number(profileData.balance ?? 0) * 100) / 100;
    const newBalance = Math.round((currentBalance + amount) * 100) / 100;

    const { error: updateError } = await admin
      .from("profiles").update({ balance: newBalance }).eq("id", userId);
    if (updateError) {
      res.status(500).json({ ok: false, error: "Erro ao creditar reembolso" }); return;
    }

    await admin.from("transactions").insert({
      user_id: userId,
      type: "refund",
      amount,
      description: JSON.stringify({ roomCode, gameType: gameType ?? "unknown", reason: "game_cancelled" }),
      status: "approved",
      created_at: new Date().toISOString(),
    });

    res.json({ ok: true, newBalance });
  } catch (err) {
    console.error("games/refund error:", err);
    res.status(500).json({ ok: false, error: "Erro interno" });
  }
}
