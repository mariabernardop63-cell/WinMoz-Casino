import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (req.method !== "GET") { res.status(405).json({ error: "Method not allowed" }); return; }

  const supabaseUrl = process.env["SUPABASE_URL"];
  const serviceKey  = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !serviceKey) {
    res.status(500).json({ error: "Faltam variáveis SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no Vercel." });
    return;
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await admin
    .from("support_messages")
    .select("user_id, user_name, sender, content, created_at")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const convMap = new Map<string, {
    userId: string;
    userName: string;
    lastMessage: string;
    lastMessageTime: string;
    unreadCount: number;
    lastSender: string;
  }>();

  (data ?? []).forEach((m: Record<string, unknown>) => {
    const uid = m.user_id as string;
    if (!convMap.has(uid)) {
      convMap.set(uid, {
        userId:          uid,
        userName:        (m.user_name as string) ?? "utilizador",
        lastMessage:     (m.content as string) ?? "",
        lastMessageTime: m.created_at as string,
        unreadCount:     0,
        lastSender:      (m.sender as string) ?? "user",
      });
    }
    if (m.sender === "user") {
      const conv = convMap.get(uid)!;
      conv.unreadCount++;
      convMap.set(uid, conv);
    }
  });

  const conversations = Array.from(convMap.values()).sort(
    (a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime()
  );

  res.status(200).json({ conversations });
}
