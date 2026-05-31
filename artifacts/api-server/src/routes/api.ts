import { Router } from "express";
import { supabaseAdmin } from "../lib/supabaseAdmin";

const router = Router();

router.post("/check-email", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email obrigatório." });

  try {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers();
    if (error) return res.status(500).json({ error: error.message });

    const exists = data.users.some(
      (u) => u.email?.toLowerCase() === email.trim().toLowerCase()
    );
    return res.json({ exists });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message ?? "Erro interno." });
  }
});

router.post("/complete-registration", async (req, res) => {
  const { user_id, full_name, phone, invite_code_used } = req.body;
  if (!user_id) return res.status(400).json({ error: "user_id obrigatório." });

  try {
    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    if (full_name) updates.full_name = full_name.trim();
    if (phone) updates.phone = phone.replace(/\D/g, "");
    if (invite_code_used) {
      updates.invite_code_used = invite_code_used;

      const { data: referrer } = await supabaseAdmin
        .from("profiles")
        .select("id, balance")
        .eq("my_invite_code", invite_code_used)
        .single();

      if (referrer) {
        const existing = await supabaseAdmin
          .from("referrals")
          .select("id")
          .eq("referred_id", user_id)
          .single();

        if (!existing.data) {
          await supabaseAdmin.from("referrals").insert({
            referrer_id: referrer.id,
            referred_id: user_id,
            bonus_paid: false,
          });
        }
      }
    }

    await supabaseAdmin.from("profiles").update(updates).eq("id", user_id);

    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message ?? "Erro interno." });
  }
});

router.post("/withdraw", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Não autenticado." });
  }
  const token = authHeader.slice(7);

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: "Token inválido." });

  const { amount, phone } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ error: "Valor inválido." });

  try {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("balance")
      .eq("id", user.id)
      .single();

    const currentBalance = parseFloat(String(profile?.balance ?? "0"));
    if (currentBalance < amount) {
      return res.status(400).json({ error: "Saldo insuficiente." });
    }

    await supabaseAdmin.from("withdrawal_requests").insert({
      user_id: user.id,
      amount,
      phone: phone || null,
      status: "pending",
    });

    await supabaseAdmin
      .from("profiles")
      .update({ balance: currentBalance - amount })
      .eq("id", user.id);

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
