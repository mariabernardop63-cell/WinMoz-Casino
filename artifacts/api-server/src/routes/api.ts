import { Router } from "express";
import { eq, sql } from "drizzle-orm";
import { db, profilesTable, transactionsTable, withdrawalRequestsTable, referralsTable } from "@workspace/db";
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
    const [profile] = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.id, user.id))
      .limit(1);

    if (!profile) return res.status(404).json({ error: "Perfil não encontrado." });

    return res.json({
      id: profile.id,
      full_name: profile.full_name,
      email: profile.email,
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
    const existing = await db
      .select({ id: profilesTable.id })
      .from(profilesTable)
      .where(eq(profilesTable.id, user_id))
      .limit(1);

    const my_invite_code = generateInviteCode();
    const normalizedEmail = (email ?? "").trim().toLowerCase();

    if (existing.length === 0) {
      await db.insert(profilesTable).values({
        id: user_id,
        email: normalizedEmail,
        full_name: full_name?.trim() ?? null,
        phone: phone?.replace(/\D/g, "") ?? null,
        invite_code_used: invite_code_used ?? null,
        my_invite_code,
        balance: "0",
      });
    } else {
      const updates: Record<string, any> = { updated_at: new Date() };
      if (full_name) updates.full_name = full_name.trim();
      if (phone) updates.phone = phone.replace(/\D/g, "");
      if (invite_code_used) updates.invite_code_used = invite_code_used;

      await db.update(profilesTable)
        .set(updates)
        .where(eq(profilesTable.id, user_id));
    }

    if (invite_code_used) {
      const [referrer] = await db
        .select({ id: profilesTable.id })
        .from(profilesTable)
        .where(eq(profilesTable.my_invite_code, invite_code_used))
        .limit(1);

      if (referrer) {
        const [existingRef] = await db
          .select({ id: referralsTable.id })
          .from(referralsTable)
          .where(eq(referralsTable.referred_id, user_id))
          .limit(1);

        if (!existingRef) {
          await db.insert(referralsTable).values({
            referrer_id: referrer.id,
            referred_id: user_id,
            bonus_paid: false,
          });
        }
      }
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
    const [profile] = await db
      .select({ balance: profilesTable.balance })
      .from(profilesTable)
      .where(eq(profilesTable.id, user.id))
      .limit(1);

    if (!profile) return res.status(404).json({ error: "Perfil não encontrado." });

    const currentBalance = parseFloat(String(profile.balance ?? "0"));
    const newBalance = parseFloat((currentBalance + amount).toFixed(2));

    await db.update(profilesTable)
      .set({ balance: String(newBalance), updated_at: new Date() })
      .where(eq(profilesTable.id, user.id));

    await db.insert(transactionsTable).values({
      user_id: user.id,
      type: "recharge",
      amount: String(amount),
      description: "Recarga de código",
      status: "completed",
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
    const [profile] = await db
      .select({ balance: profilesTable.balance })
      .from(profilesTable)
      .where(eq(profilesTable.id, user.id))
      .limit(1);

    if (!profile) return res.status(404).json({ error: "Perfil não encontrado." });

    const currentBalance = parseFloat(String(profile.balance ?? "0"));
    if (currentBalance < amount) {
      return res.status(400).json({ error: "Saldo insuficiente." });
    }

    const newBalance = parseFloat((currentBalance - amount).toFixed(2));

    await db.update(profilesTable)
      .set({ balance: String(newBalance), updated_at: new Date() })
      .where(eq(profilesTable.id, user.id));

    await db.insert(withdrawalRequestsTable).values({
      user_id: user.id,
      amount: String(amount),
      phone: phone || null,
      status: "pending",
    });

    await db.insert(transactionsTable).values({
      user_id: user.id,
      type: "withdrawal",
      amount: String(amount),
      description: `Levantamento M-Pesa ${phone || ""}`.trim(),
      status: "pending",
    });

    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message ?? "Erro interno." });
  }
});

export default router;
