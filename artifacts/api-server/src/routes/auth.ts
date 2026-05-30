import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, profilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

function generateInviteCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function saveSession(req: any): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.save((err: Error | null) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

router.post("/register", async (req, res) => {
  const { full_name, email, phone, password, invite_code_used } = req.body;

  if (!full_name || !email || !password) {
    return res.status(400).json({ error: "Campos obrigatórios em falta." });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: "A senha deve ter pelo menos 8 caracteres." });
  }

  const normEmail = email.trim().toLowerCase();

  const existing = await db
    .select({ id: profilesTable.id })
    .from(profilesTable)
    .where(eq(profilesTable.email, normEmail))
    .limit(1);

  if (existing.length > 0) {
    return res.status(409).json({ error: "Este email já está registado. Por favor, inicie sessão." });
  }

  const password_hash = await bcrypt.hash(password, 12);

  let my_invite_code = generateInviteCode();
  let attempts = 0;
  while (attempts < 5) {
    const codeConflict = await db
      .select({ id: profilesTable.id })
      .from(profilesTable)
      .where(eq(profilesTable.my_invite_code, my_invite_code))
      .limit(1);
    if (codeConflict.length === 0) break;
    my_invite_code = generateInviteCode();
    attempts++;
  }

  const [profile] = await db
    .insert(profilesTable)
    .values({
      full_name: full_name.trim(),
      email: normEmail,
      phone: phone ?? null,
      password_hash,
      invite_code_used: invite_code_used ?? null,
      my_invite_code,
    })
    .returning();

  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: "Erro ao criar sessão." });
    (req.session as any).userId = profile.id;
    req.session.save((saveErr) => {
      if (saveErr) return res.status(500).json({ error: "Erro ao guardar sessão." });
      const { password_hash: _ph, ...safeProfile } = profile;
      return res.status(201).json({ user: { id: profile.id, email: profile.email }, profile: safeProfile });
    });
  });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email e senha são obrigatórios." });
  }

  const normEmail = email.trim().toLowerCase();

  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.email, normEmail))
    .limit(1);

  if (!profile) {
    return res.status(401).json({ error: "Email ou palavra-passe incorretos." });
  }

  const valid = await bcrypt.compare(password, profile.password_hash);
  if (!valid) {
    return res.status(401).json({ error: "Email ou palavra-passe incorretos." });
  }

  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: "Erro ao criar sessão." });
    (req.session as any).userId = profile.id;
    req.session.save((saveErr) => {
      if (saveErr) return res.status(500).json({ error: "Erro ao guardar sessão." });
      const { password_hash: _ph, ...safeProfile } = profile;
      return res.json({ user: { id: profile.id, email: profile.email }, profile: safeProfile });
    });
  });
});

router.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: "Erro ao terminar sessão." });
    res.clearCookie("winmoz.sid");
    return res.json({ ok: true });
  });
});

router.get("/me", async (req, res) => {
  const sess = req.session as any;
  if (!sess.userId) {
    return res.status(401).json({ error: "Não autenticado." });
  }

  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.id, sess.userId))
    .limit(1);

  if (!profile) {
    req.session.destroy(() => {});
    return res.status(401).json({ error: "Utilizador não encontrado." });
  }

  const { password_hash: _ph, ...safeProfile } = profile;
  return res.json({ user: { id: profile.id, email: profile.email }, profile: safeProfile });
});

router.put("/profile", async (req, res) => {
  const sess = req.session as any;
  if (!sess.userId) {
    return res.status(401).json({ error: "Não autenticado." });
  }

  const { full_name, phone, avatar_url } = req.body;

  const [updated] = await db
    .update(profilesTable)
    .set({
      full_name: full_name ?? undefined,
      phone: phone ?? undefined,
      avatar_url: avatar_url !== undefined ? avatar_url : undefined,
      updated_at: new Date(),
    })
    .where(eq(profilesTable.id, sess.userId))
    .returning();

  if (!updated) {
    return res.status(404).json({ error: "Perfil não encontrado." });
  }

  const { password_hash: _ph, ...safeProfile } = updated;
  return res.json({ profile: safeProfile });
});

router.post("/forgot-password", async (req, res) => {
  return res.json({ ok: true, message: "Se o email existir, receberá instruções em breve." });
});

router.post("/reset-password", async (req, res) => {
  const sess = req.session as any;
  if (!sess.userId) {
    return res.status(401).json({ error: "Não autenticado." });
  }

  const { password } = req.body;
  if (!password || password.length < 8) {
    return res.status(400).json({ error: "A senha deve ter pelo menos 8 caracteres." });
  }

  const password_hash = await bcrypt.hash(password, 12);

  await db
    .update(profilesTable)
    .set({ password_hash, updated_at: new Date() })
    .where(eq(profilesTable.id, sess.userId));

  return res.json({ ok: true });
});

export default router;
