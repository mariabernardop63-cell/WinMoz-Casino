import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, profilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { randomBytes } from "crypto";

const router = Router();

function generateInviteCode(): string {
  return randomBytes(3).toString("hex").toUpperCase();
}

function getSessionUser(req: any): { id: string; email: string } | null {
  return req.session?.user ?? null;
}

router.post("/register", async (req, res) => {
  const { full_name, email, phone, password, invite_code_used } = req.body;

  if (!full_name || !email || !password) {
    return res.status(400).json({ error: "Campos obrigatórios em falta." });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "A senha deve ter pelo menos 8 caracteres." });
  }

  const normalizedEmail = email.trim().toLowerCase();

  const existing = await db
    .select({ id: profilesTable.id })
    .from(profilesTable)
    .where(eq(profilesTable.email, normalizedEmail))
    .limit(1);

  if (existing.length > 0) {
    return res.status(409).json({ error: "Este email já está registado. Por favor, inicie sessão." });
  }

  const password_hash = await bcrypt.hash(password, 12);
  const my_invite_code = generateInviteCode();

  const [profile] = await db
    .insert(profilesTable)
    .values({
      full_name: full_name.trim(),
      email: normalizedEmail,
      phone: phone ?? null,
      password_hash,
      my_invite_code,
      invite_code_used: invite_code_used ?? null,
    })
    .returning();

  req.session.user = { id: profile.id, email: profile.email };

  return res.status(201).json({
    token: profile.id,
    user: { id: profile.id, email: profile.email },
    profile: {
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
    },
  });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email e senha são obrigatórios." });
  }

  const normalizedEmail = email.trim().toLowerCase();

  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.email, normalizedEmail))
    .limit(1);

  if (!profile) {
    return res.status(401).json({ error: "Email ou palavra-passe incorretos." });
  }

  const valid = await bcrypt.compare(password, profile.password_hash);
  if (!valid) {
    return res.status(401).json({ error: "Email ou palavra-passe incorretos." });
  }

  req.session.user = { id: profile.id, email: profile.email };

  return res.json({
    token: profile.id,
    user: { id: profile.id, email: profile.email },
    profile: {
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
    },
  });
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("winmoz.sid");
    return res.json({ ok: true });
  });
});

router.get("/me", async (req, res) => {
  const sessionUser = getSessionUser(req);

  const token = (req.headers["authorization"] ?? "").replace("Bearer ", "").trim();
  const userId = sessionUser?.id ?? (token && token.length === 36 ? token : null);

  if (!userId) return res.status(401).json({ error: "Não autenticado." });

  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.id, userId))
    .limit(1);

  if (!profile) return res.status(401).json({ error: "Não autenticado." });

  if (!sessionUser) {
    req.session.user = { id: profile.id, email: profile.email };
  }

  return res.json({
    token: profile.id,
    user: { id: profile.id, email: profile.email },
    profile: {
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
    },
  });
});

router.put("/profile", async (req, res) => {
  const sessionUser = getSessionUser(req);
  const token = (req.headers["authorization"] ?? "").replace("Bearer ", "").trim();
  const userId = sessionUser?.id ?? (token && token.length === 36 ? token : null);

  if (!userId) return res.status(401).json({ error: "Não autenticado." });

  const { full_name, phone, avatar_url } = req.body;
  const updates: Record<string, unknown> = { updated_at: new Date() };
  if (full_name !== undefined) updates.full_name = full_name;
  if (phone !== undefined) updates.phone = phone;
  if (avatar_url !== undefined) updates.avatar_url = avatar_url;

  const [profile] = await db
    .update(profilesTable)
    .set(updates)
    .where(eq(profilesTable.id, userId))
    .returning();

  if (!profile) return res.status(404).json({ error: "Perfil não encontrado." });

  return res.json({
    profile: {
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
    },
  });
});

router.post("/forgot-password", (req, res) => {
  return res.json({ ok: true, message: "Se o email existir, receberá instruções em breve." });
});

router.post("/reset-password", async (req, res) => {
  const sessionUser = getSessionUser(req);
  const token = (req.headers["authorization"] ?? "").replace("Bearer ", "").trim();
  const userId = sessionUser?.id ?? (token && token.length === 36 ? token : null);

  if (!userId) return res.status(401).json({ error: "Não autenticado." });

  const { password } = req.body;
  if (!password || password.length < 8) {
    return res.status(400).json({ error: "A senha deve ter pelo menos 8 caracteres." });
  }

  const password_hash = await bcrypt.hash(password, 12);
  await db
    .update(profilesTable)
    .set({ password_hash, updated_at: new Date() })
    .where(eq(profilesTable.id, userId));

  return res.json({ ok: true });
});

export default router;
