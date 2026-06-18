import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  const { type, value, adminEmail } = (req.body ?? {}) as {
    type?: string;
    value?: string;
    adminEmail?: string;
  };

  if (!type || !value || !adminEmail) {
    res.status(400).json({ error: "Parâmetros em falta (type, value, adminEmail)" });
    return;
  }
  if (type !== "email" && type !== "password") {
    res.status(400).json({ error: "Tipo inválido" });
    return;
  }

  const supabaseUrl = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"] ?? "";
  const supabaseServiceKey =
    process.env["SUPABASE_SERVICE_ROLE_KEY"] ??
    process.env["VITE_SUPABASE_SERVICE_ROLE"] ??
    process.env["VITE_SUPABASE_SERVICE_ROLE_KEY"] ??
    "";

  if (!supabaseUrl || !supabaseServiceKey) {
    res.status(503).json({ error: "Serviço indisponível (credenciais do servidor não configuradas)" });
    return;
  }

  try {
    const admin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: listData, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 });
    if (listErr) {
      res.status(500).json({ error: "Erro ao procurar utilizador: " + listErr.message });
      return;
    }

    const users = listData?.users ?? [];
    const user = users.find(u => u.email?.toLowerCase() === adminEmail.toLowerCase().trim());
    if (!user) {
      res.status(404).json({ error: "Nenhuma conta encontrada com o e-mail: " + adminEmail });
      return;
    }

    const updateData: { email?: string; password?: string } = {};
    if (type === "email") updateData.email = value.trim();
    if (type === "password") updateData.password = value;

    const { error: updateErr } = await admin.auth.admin.updateUserById(user.id, updateData);
    if (updateErr) {
      res.status(500).json({ error: "Erro ao actualizar: " + updateErr.message });
      return;
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("update-admin-credentials error:", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
}
