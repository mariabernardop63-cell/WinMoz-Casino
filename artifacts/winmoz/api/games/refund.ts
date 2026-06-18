import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const ALLOWED_GAME_TYPES = new Set(["Ludo", "Damas", "Xadrez"]);
const MAX_REFUND = 50_000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  const authHeader = req.headers.authorization ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key) return res.status(500).json({ error: "Server misconfigured" });

  const body = req.body as Record<string, unknown>;
  const roomCode = body["roomCode"];
  const amount = body["amount"];
  const gameType = body["gameType"];

  if (
    typeof roomCode !== "string" || roomCode.length === 0 || roomCode.length > 120 ||
    typeof amount !== "number" || amount <= 0 || amount > MAX_REFUND ||
    typeof gameType !== "string" || !ALLOWED_GAME_TYPES.has(gameType)
  ) {
    return res.status(400).json({ error: "Parâmetros inválidos" });
  }

  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: { user }, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !user) return res.status(401).json({ error: "Sessão inválida" });

  const userId = user.id;

  const { data: existingRefund } = await admin
    .from("transactions")
    .select("id")
    .eq("user_id", userId)
    .like("description", `%Reembolso sala ${roomCode}%`)
    .maybeSingle();

  if (existingRefund) {
    const { data: prof } = await admin.from("profiles").select("balance").eq("id", userId).single();
    return res.status(200).json({ ok: true, newBalance: parseFloat(String(prof?.balance ?? 0)), duplicate: true });
  }

  const { data: profile, error: profErr } = await admin
    .from("profiles").select("balance").eq("id", userId).single();
  if (profErr || !profile) return res.status(500).json({ error: "Perfil não encontrado" });

  const currentBal = parseFloat(String(profile.balance ?? 0));
  const newBalance = Math.round((currentBal + amount) * 100) / 100;

  const { error: updateErr } = await admin
    .from("profiles").update({ balance: newBalance }).eq("id", userId);
  if (updateErr) return res.status(500).json({ error: "Erro ao processar reembolso" });

  await admin.from("transactions").insert({
    user_id: userId,
    type: "win",
    amount,
    description: `Reembolso sala ${roomCode}`,
    status: "approved",
    created_at: new Date().toISOString(),
  });

  return res.status(200).json({ ok: true, newBalance });
}
