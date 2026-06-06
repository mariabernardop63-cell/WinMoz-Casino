import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (req.method !== "GET") { res.status(405).json({ error: "Method not allowed" }); return; }

  const userId = req.query["userId"] as string | undefined;
  if (!userId) { res.status(400).json({ error: "userId é obrigatório" }); return; }

  const supabaseUrl = process.env["SUPABASE_URL"];
  const serviceKey  = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !serviceKey) {
    res.status(500).json({ error: "Servidor não configurado: faltam variáveis SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no Vercel." });
    return;
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await admin
    .from("support_messages")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const messages = (data ?? []).map((m: Record<string, unknown>) => ({
    id:          m.id as string,
    userId:      m.user_id as string,
    userName:    (m.user_name as string) ?? "utilizador",
    sender:      (m.sender as "user" | "admin" | "ai") ?? "user",
    content:     (m.content as string) ?? "",
    createdAt:   m.created_at as string,
    readByAdmin: (m.read_by_admin as boolean) ?? false,
  }));

  res.status(200).json({ messages });
}
