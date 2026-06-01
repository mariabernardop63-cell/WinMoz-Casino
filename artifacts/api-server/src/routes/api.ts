import { Router } from "express";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { randomBytes } from "crypto";

const router = Router();

function generateInviteCode(): string {
  return randomBytes(3).toString("hex").toUpperCase();
}

async function getUserFromToken(authHeader: string | undefined) {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

router.post("/check-email", async (_req, res) => {
  return res.json({ exists: false });
});

router.get("/profile", async (req, res) => {
  const user = await getUserFromToken(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "Não autenticado." });

  try {
    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (error || !profile) return res.status(404).json({ error: "Perfil não encontrado." });

    return res.json({
      id: profile.id,
      full_name: profile.full_name,
      email: user.email,
      phone: profile.phone,
      avatar_url: profile.avatar_url,
      invite_code_used: profile.invite_code_used,
      my_invite_code: profile.my_invite_code,
      balance: profile.balance ?? "0",
      created_at: profile.created_at,
      updated_at: profile.updated_at,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message ?? "Erro interno." });
  }
});

router.post("/complete-registration", async (req, res) => {
  const { user_id, full_name, phone, invite_code_used, email } = req.body;
  if (!user_id) return res.status(400).json({ error: "user_id obrigatório." });

  try {
    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("id, my_invite_code")
      .eq("id", user_id)
      .single();

    if (!existing) {
      const my_invite_code = generateInviteCode();
      await supabaseAdmin.from("profiles").insert({
        id: user_id,
        full_name: full_name?.trim() ?? null,
        phone: phone?.replace(/\D/g, "") ?? null,
        invite_code_used: invite_code_used ?? null,
        my_invite_code,
        balance: 0,
      });

      if (invite_code_used) {
        const { data: referrer } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("my_invite_code", invite_code_used)
          .single();

        if (referrer) {
          await supabaseAdmin.from("referrals").insert({
            referrer_id: referrer.id,
            referred_id: user_id,
            bonus_paid: false,
          });
        }
      }
    } else {
      const updates: Record<string, any> = { updated_at: new Date().toISOString() };
      if (full_name) updates.full_name = full_name.trim();
      if (phone) updates.phone = phone.replace(/\D/g, "");

      await supabaseAdmin.from("profiles").update(updates).eq("id", user_id);
    }

    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message ?? "Erro interno." });
  }
});

router.post("/recharge", async (req, res) => {
  const user = await getUserFromToken(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "Não autenticado." });

  const { amount } = req.body;
  if (!amount || typeof amount !== "number" || amount <= 0) {
    return res.status(400).json({ error: "Valor inválido." });
  }

  try {
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from("profiles")
      .select("balance")
      .eq("id", user.id)
      .single();

    if (profileErr || !profile) return res.status(404).json({ error: "Perfil não encontrado." });

    const currentBalance = parseFloat(String(profile.balance ?? "0"));
    const newBalance = parseFloat((currentBalance + amount).toFixed(2));

    const { error: updateErr } = await supabaseAdmin
      .from("profiles")
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq("id", user.id);

    if (updateErr) throw updateErr;

    await supabaseAdmin.from("transactions").insert({
      user_id: user.id,
      type: "recharge",
      amount,
      description: "Recarga de código",
      status: "approved",
    });

    return res.json({ ok: true, balance: newBalance });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message ?? "Erro interno." });
  }
});

router.post("/withdraw", async (req, res) => {
  const user = await getUserFromToken(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "Não autenticado." });

  const { amount, phone } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ error: "Valor inválido." });

  try {
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from("profiles")
      .select("balance")
      .eq("id", user.id)
      .single();

    if (profileErr || !profile) return res.status(404).json({ error: "Perfil não encontrado." });

    const currentBalance = parseFloat(String(profile.balance ?? "0"));
    if (currentBalance < amount) {
      return res.status(400).json({ error: "Saldo insuficiente." });
    }

    const newBalance = parseFloat((currentBalance - amount).toFixed(2));

    await supabaseAdmin
      .from("profiles")
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq("id", user.id);

    await supabaseAdmin.from("withdrawal_requests").insert({
      user_id: user.id,
      amount,
      phone: phone || null,
      status: "pending",
    });

    await supabaseAdmin.from("transactions").insert({
      user_id: user.id,
      type: "withdrawal",
      amount,
      description: `Levantamento M-Pesa ${phone || ""}`.trim(),
      status: "pending",
    });

    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message ?? "Erro interno." });
  }
});

export default router;
