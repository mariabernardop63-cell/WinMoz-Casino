import { Router } from "express";
import { supabase } from "../lib/supabase";

const router = Router();

async function getAuthedUser(req: any) {
  const authHeader = req.headers["authorization"] ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

router.post("/register", async (req, res) => {
  const { full_name, email, phone, password, invite_code_used } = req.body;

  if (!full_name || !email || !password) {
    return res.status(400).json({ error: "Campos obrigatórios em falta." });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "A senha deve ter pelo menos 8 caracteres." });
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: email.trim().toLowerCase(),
    password,
    email_confirm: true,
    user_metadata: { full_name: full_name.trim(), phone: phone ?? null },
  });

  if (error) {
    if (error.message.includes("already registered") || error.message.includes("already been registered")) {
      return res.status(409).json({ error: "Este email já está registado. Por favor, inicie sessão." });
    }
    return res.status(400).json({ error: error.message });
  }

  const userId = data.user.id;

  if (invite_code_used) {
    await supabase
      .from("profiles")
      .update({ invite_code_used })
      .eq("id", userId);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });

  if (signInError) {
    return res.status(500).json({ error: "Conta criada mas erro ao iniciar sessão. Tente fazer login." });
  }

  return res.status(201).json({
    token: signInData.session?.access_token,
    user: { id: userId, email: data.user.email },
    profile: profile ?? { id: userId, full_name: full_name.trim(), email: data.user.email, balance: "0" },
  });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email e senha são obrigatórios." });
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });

  if (error || !data.session) {
    return res.status(401).json({ error: "Email ou palavra-passe incorretos." });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", data.user.id)
    .single();

  return res.json({
    token: data.session.access_token,
    user: { id: data.user.id, email: data.user.email },
    profile: profile ?? { id: data.user.id, email: data.user.email, balance: "0" },
  });
});

router.post("/logout", async (req, res) => {
  const user = await getAuthedUser(req);
  if (user) {
    const authHeader = req.headers["authorization"] ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (token) await supabase.auth.admin.signOut(token);
  }
  return res.json({ ok: true });
});

router.get("/me", async (req, res) => {
  const user = await getAuthedUser(req);
  if (!user) return res.status(401).json({ error: "Não autenticado." });

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return res.json({
    user: { id: user.id, email: user.email },
    profile: profile ?? { id: user.id, email: user.email, balance: "0" },
  });
});

router.put("/profile", async (req, res) => {
  const user = await getAuthedUser(req);
  if (!user) return res.status(401).json({ error: "Não autenticado." });

  const { full_name, phone, avatar_url } = req.body;

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (full_name !== undefined) updates.full_name = full_name;
  if (phone !== undefined) updates.phone = phone;
  if (avatar_url !== undefined) updates.avatar_url = avatar_url;

  const { data: profile, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", user.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  return res.json({ profile });
});

router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  if (email) {
    await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase());
  }
  return res.json({ ok: true, message: "Se o email existir, receberá instruções em breve." });
});

router.post("/reset-password", async (req, res) => {
  const user = await getAuthedUser(req);
  if (!user) return res.status(401).json({ error: "Não autenticado." });

  const { password } = req.body;
  if (!password || password.length < 8) {
    return res.status(400).json({ error: "A senha deve ter pelo menos 8 caracteres." });
  }

  const { error } = await supabase.auth.admin.updateUserById(user.id, { password });
  if (error) return res.status(500).json({ error: error.message });

  return res.json({ ok: true });
});

export default router;
