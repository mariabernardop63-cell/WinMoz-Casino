import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authenticateAdmin, getSupabaseAdmin, setCorsHeaders } from "../../_lib/auth";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);
  if (req.method === "OPTIONS") { res.status(204).end(); return; }

  const auth = await authenticateAdmin(req);
  if (!auth) { res.status(403).json({ error: "Acesso negado" }); return; }

  const admin = getSupabaseAdmin();

  if (req.method === "GET") {
    const userId = req.query["userId"] as string | undefined;

    try {
      if (userId) {
        const { data, error } = await admin
          .from("support_messages")
          .select("id, user_id, user_name, sender, content, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: true });

        if (error) {
          console.error("[support/conversations] messages error:", error);
          res.status(500).json({ error: error.message });
          return;
        }

        res.setHeader("Cache-Control", "no-store");
        res.status(200).json(data ?? []);
        return;
      }

      const { data, error } = await admin
        .from("support_messages")
        .select("user_id, user_name, sender, content, created_at")
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) {
        console.error("[support/conversations] list error:", error);
        res.status(500).json({ error: error.message });
        return;
      }

      const userIds = Array.from(new Set((data ?? []).map((m: Record<string, unknown>) => m.user_id as string)));
      let profileMap: Record<string, string | null> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await admin
          .from("profiles")
          .select("id, avatar_url")
          .in("id", userIds);
        (profiles ?? []).forEach((p: Record<string, unknown>) => {
          profileMap[p.id as string] = (p.avatar_url as string) ?? null;
        });
      }

      const lastAdminReplyTime = new Map<string, string>();
      (data ?? []).forEach((m: Record<string, unknown>) => {
        const uid = m.user_id as string;
        if ((m.sender === "admin" || m.sender === "ai") && !lastAdminReplyTime.has(uid)) {
          lastAdminReplyTime.set(uid, m.created_at as string);
        }
      });

      const convMap = new Map<string, {
        userId: string;
        userName: string;
        avatarUrl: string | null;
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
            avatarUrl:       profileMap[uid] ?? null,
            lastMessage:     (m.content as string) ?? "",
            lastMessageTime: m.created_at as string,
            unreadCount:     0,
            lastSender:      (m.sender as string) ?? "user",
          });
        }
        if (m.sender === "user") {
          const lastReply = lastAdminReplyTime.get(uid);
          const isUnread = !lastReply || new Date(m.created_at as string) > new Date(lastReply);
          if (isUnread) {
            const conv = convMap.get(uid)!;
            conv.unreadCount++;
            convMap.set(uid, conv);
          }
        }
      });

      const result = Array.from(convMap.values()).sort(
        (a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime()
      );

      res.setHeader("Cache-Control", "no-store");
      res.status(200).json(result);
    } catch (err) {
      console.error("[support/conversations] unexpected:", err);
      res.status(500).json({ error: "Erro interno" });
    }
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}
