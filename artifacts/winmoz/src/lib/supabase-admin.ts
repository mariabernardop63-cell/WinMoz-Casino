import { supabase } from "./supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AdminProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  balance: number;
  created_at: string;
  is_blocked: boolean;
  block_type: string | null;
  last_seen_at: string | null;
  total_games: number;
  total_wins: number;
  is_admin: boolean;
}

export interface AdminMatch {
  id: string;
  game_type: string;
  status: string;
  player1_id: string | null;
  player2_id: string | null;
  winner_id: string | null;
  player1_name: string | null;
  player2_name: string | null;
  winner_name: string | null;
  bet_amount: number;
  platform_fee: number;
  winner_payout: number;
  created_at: string;
  completed_at: string | null;
}

export interface AdminWithdrawal {
  id: string;
  user_id: string;
  user_name: string | null;
  amount: number;
  fee: number;
  net_amount: number;
  phone: string | null;
  method: string;
  status: string;
  rejection_reason: string | null;
  created_at: string;
  processed_at: string | null;
}

export interface AdminTransaction {
  id: string;
  user_id: string;
  type: string;
  amount: number;
  description: string | null;
  status: string;
  created_at: string;
  profiles?: { full_name: string | null; email: string | null };
}

export interface AdminReport {
  id: string;
  user_id: string | null;
  user_name: string | null;
  user_email: string | null;
  category: string;
  priority: string;
  description: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminNotification {
  id: string;
  title: string;
  subtitle: string | null;
  type: string;
  image_url: string | null;
  action_button_label: string | null;
  action_button_url: string | null;
  target: string;
  created_at: string;
}

export interface AdminSupportMessage {
  id: string;
  user_id: string;
  user_name: string | null;
  sender: string;
  content: string;
  created_at: string;
}

export interface AdminBlockedUser {
  id: string;
  user_id: string;
  user_name: string | null;
  block_type: string;
  reason: string | null;
  blocked_ip: string | null;
  is_active: boolean;
  created_at: string;
  unblocked_at: string | null;
}

export interface PlatformSettings {
  [key: string]: string;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export async function getDashboardStats() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = today.toISOString();

  const [
    profilesRes,
    withdrawalsPendingRes,
    matchesActiveRes,
    earningsRes,
    earningsTodayRes,
    withdrawalsTodayRes,
    transactionsTodayRes,
    onlineRes,
    matchesCountRes,
  ] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("withdrawals").select("id, amount", { count: "exact" }).eq("status", "pending"),
    supabase.from("matches").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("platform_earnings").select("amount").gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString()),
    supabase.from("platform_earnings").select("amount").gte("created_at", todayISO),
    supabase.from("withdrawals").select("amount").eq("status", "approved").gte("processed_at", todayISO),
    supabase.from("transactions").select("id", { count: "exact", head: true }).gte("created_at", todayISO),
    supabase.from("profiles").select("id", { count: "exact", head: true }).gte("last_seen_at", new Date(Date.now() - 5 * 60 * 1000).toISOString()),
    supabase.from("matches").select("game_type").eq("status", "completed"),
  ]);

  const totalEarnings = (earningsRes.data ?? []).reduce((s, r) => s + Number(r.amount), 0);
  const todayEarnings = (earningsTodayRes.data ?? []).reduce((s, r) => s + Number(r.amount), 0);
  const todayWithdrawals = (withdrawalsTodayRes.data ?? []).reduce((s, r) => s + Number(r.amount), 0);
  const pendingWithdrawals = withdrawalsPendingRes.data ?? [];
  const pendingVolume = pendingWithdrawals.reduce((s, r) => s + Number(r.amount), 0);

  const gameCounts: Record<string, number> = {};
  for (const m of (matchesCountRes.data ?? [])) {
    gameCounts[m.game_type] = (gameCounts[m.game_type] ?? 0) + 1;
  }

  return {
    totalRegistered: profilesRes.count ?? 0,
    pendingWithdrawalsCount: pendingWithdrawals.length,
    pendingWithdrawalsVolume: pendingVolume,
    activeMatches: matchesActiveRes.count ?? 0,
    onlineNow: onlineRes.count ?? 0,
    platformBalance: totalEarnings,
    todayEarnings,
    todayWithdrawals,
    todayTransactions: transactionsTodayRes.count ?? 0,
    gameCounts,
  };
}

export async function getRecentMatches(limit = 10) {
  const { data } = await supabase
    .from("matches")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as AdminMatch[];
}

export async function getEarningsChartData() {
  const days = 30;
  const from = new Date(Date.now() - days * 86400000).toISOString();
  const { data } = await supabase
    .from("platform_earnings")
    .select("amount, created_at")
    .gte("created_at", from)
    .order("created_at", { ascending: true });

  const byDay: Record<string, number> = {};
  for (const r of (data ?? [])) {
    const day = r.created_at.slice(0, 10);
    byDay[day] = (byDay[day] ?? 0) + Number(r.amount);
  }

  const result = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const key = d.toISOString().slice(0, 10);
    result.push({ date: key, valor: byDay[key] ?? 0 });
  }
  return result;
}

// ─── Matches ──────────────────────────────────────────────────────────────────

export async function listMatches(filter?: { status?: string; game_type?: string }) {
  let q = supabase
    .from("matches")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (filter?.status) q = q.eq("status", filter.status);
  if (filter?.game_type) q = q.eq("game_type", filter.game_type);

  const { data } = await q;
  return (data ?? []) as AdminMatch[];
}

export async function createMatch(match: {
  game_type: string;
  player1_id: string;
  player2_id: string;
  player1_name: string;
  player2_name: string;
  bet_amount: number;
  game_channel?: string;
}) {
  const { data, error } = await supabase.from("matches").insert(match).select().single();
  if (error) throw error;
  return data as AdminMatch;
}

export async function completeMatch(matchId: string, winnerId: string, winnerName: string) {
  const { data: match } = await supabase.from("matches").select("*").eq("id", matchId).single();
  if (!match) throw new Error("Match not found");

  const pot = match.bet_amount * 2;
  const platformFee = pot * 0.10;
  const winnerPayout = pot * 0.90;

  const { error } = await supabase.from("matches").update({
    status: "completed",
    winner_id: winnerId,
    winner_name: winnerName,
    platform_fee: platformFee,
    winner_payout: winnerPayout,
    completed_at: new Date().toISOString(),
  }).eq("id", matchId);
  if (error) throw error;

  const { data: winnerProfile } = await supabase.from("profiles").select("balance, total_wins").eq("id", winnerId).single();
  if (winnerProfile) {
    await supabase.from("profiles").update({
      balance: Number(winnerProfile.balance) + winnerPayout,
      total_wins: (winnerProfile.total_wins ?? 0) + 1,
    }).eq("id", winnerId);
  }

  await Promise.all([
    supabase.from("platform_earnings").insert({
      type: "bet_fee",
      amount: platformFee,
      reference_id: matchId,
      user_id: winnerId,
    }),
    supabase.from("transactions").insert({
      user_id: winnerId,
      type: "win",
      amount: winnerPayout,
      description: `Vitória em ${match.game_type} (90% de MT ${pot.toFixed(2)})`,
      status: "approved",
    }),
  ]);

  return { platformFee, winnerPayout };
}

// ─── Players ──────────────────────────────────────────────────────────────────

export async function listPlayers(opts?: { search?: string; limit?: number; offset?: number }) {
  let q = supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(opts?.limit ?? 100);

  if (opts?.offset) q = q.range(opts.offset, opts.offset + (opts.limit ?? 100) - 1);
  if (opts?.search) {
    q = q.or(`full_name.ilike.%${opts.search}%,email.ilike.%${opts.search}%,phone.ilike.%${opts.search}%`);
  }

  const { data } = await q;
  return (data ?? []) as AdminProfile[];
}

export async function getPlayerById(id: string) {
  const { data } = await supabase.from("profiles").select("*").eq("id", id).single();
  return data as AdminProfile | null;
}

// ─── Transactions ─────────────────────────────────────────────────────────────

export async function listTransactions(filter?: { type?: string; limit?: number }) {
  let q = supabase
    .from("transactions")
    .select("*, profiles(full_name, email)")
    .order("created_at", { ascending: false })
    .limit(filter?.limit ?? 200);

  if (filter?.type) q = q.eq("type", filter.type);

  const { data } = await q;
  return (data ?? []) as AdminTransaction[];
}

// ─── Withdrawals ──────────────────────────────────────────────────────────────

export async function listWithdrawals(filter?: { status?: string }) {
  let q = supabase
    .from("withdrawals")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (filter?.status) q = q.eq("status", filter.status);

  const { data } = await q;
  return (data ?? []) as AdminWithdrawal[];
}

export async function approveWithdrawal(id: string, adminId: string) {
  const { data: w, error: fetchError } = await supabase
    .from("withdrawals")
    .select("*")
    .eq("id", id)
    .single();
  if (fetchError || !w) throw new Error("Withdrawal not found");

  const { error } = await supabase.from("withdrawals").update({
    status: "approved",
    approved_by: adminId,
    processed_at: new Date().toISOString(),
  }).eq("id", id);
  if (error) throw error;

  await supabase.from("platform_earnings").insert({
    type: "withdrawal_fee",
    amount: w.fee,
    reference_id: id,
    user_id: w.user_id,
  });

  await supabase.from("transactions").insert({
    user_id: w.user_id,
    type: "withdrawal",
    amount: -w.net_amount,
    description: `Levantamento via ${w.method}`,
    status: "approved",
  });
}

export async function rejectWithdrawal(id: string, adminId: string, reason: string) {
  const { data: w } = await supabase.from("withdrawals").select("*").eq("id", id).single();
  if (!w) throw new Error("Withdrawal not found");

  const { error } = await supabase.from("withdrawals").update({
    status: "rejected",
    rejection_reason: reason,
    approved_by: adminId,
    processed_at: new Date().toISOString(),
  }).eq("id", id);
  if (error) throw error;

  const { data: profile } = await supabase.from("profiles").select("balance").eq("id", w.user_id).single();
  if (profile) {
    const restoredBalance = Number(profile.balance) + Number(w.amount) + Number(w.fee);
    await supabase.from("profiles").update({ balance: restoredBalance }).eq("id", w.user_id);
  }

  await supabase.from("transactions").insert({
    user_id: w.user_id,
    type: "refund",
    amount: Number(w.amount) + Number(w.fee),
    description: `Levantamento rejeitado — ${reason}`,
    status: "approved",
  });
}

// ─── Reports ──────────────────────────────────────────────────────────────────

export async function listReports(filter?: { status?: string }) {
  let q = supabase
    .from("reports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (filter?.status) q = q.eq("status", filter.status);
  const { data } = await q;
  return (data ?? []) as AdminReport[];
}

export async function updateReportStatus(id: string, status: string, adminNotes?: string) {
  const { error } = await supabase.from("reports").update({
    status,
    admin_notes: adminNotes,
    updated_at: new Date().toISOString(),
  }).eq("id", id);
  if (error) throw error;
}

// ─── Notifications ────────────────────────────────────────────────────────────

export async function listNotifications() {
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  return (data ?? []) as AdminNotification[];
}

export async function sendNotification(notif: {
  title: string;
  subtitle?: string;
  type: "notification" | "announcement";
  image_url?: string;
  action_button_label?: string;
  action_button_url?: string;
  target: "all" | "specific";
  target_user_ids?: string[];
  sent_by: string;
}) {
  const { data, error } = await supabase.from("notifications").insert(notif).select().single();
  if (error) throw error;
  return data as AdminNotification;
}

// ─── Support Messages ─────────────────────────────────────────────────────────

export async function listSupportConversations() {
  const { data } = await supabase
    .from("support_messages")
    .select("user_id, user_name, created_at")
    .order("created_at", { ascending: false });

  if (!data) return [];

  const seen = new Set<string>();
  const convs: { user_id: string; user_name: string; last_at: string; unread: number }[] = [];
  for (const m of data) {
    if (!seen.has(m.user_id)) {
      seen.add(m.user_id);
      convs.push({ user_id: m.user_id, user_name: m.user_name ?? "Usuário", last_at: m.created_at, unread: 0 });
    }
  }
  return convs;
}

export async function getSupportMessages(userId: string) {
  const { data } = await supabase
    .from("support_messages")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(200);
  return (data ?? []) as AdminSupportMessage[];
}

export async function sendAdminMessage(userId: string, content: string) {
  const { error } = await supabase.from("support_messages").insert({
    user_id: userId,
    user_name: "Admin",
    sender: "admin",
    content,
  });
  if (error) throw error;
}

// ─── Online Users ─────────────────────────────────────────────────────────────

export async function listOnlineUsers() {
  const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .gte("last_seen_at", cutoff)
    .order("last_seen_at", { ascending: false })
    .limit(200);
  return (data ?? []) as AdminProfile[];
}

export async function listAllUsersWithStatus() {
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .order("last_seen_at", { ascending: false })
    .limit(200);

  const cutoff = Date.now() - 5 * 60 * 1000;
  return (data ?? []).map(p => ({
    ...(p as AdminProfile),
    isOnline: p.last_seen_at ? new Date(p.last_seen_at).getTime() > cutoff : false,
  }));
}

// ─── Balance Management ───────────────────────────────────────────────────────

export async function searchPlayersForBalance(query: string) {
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email, balance, avatar_url, is_blocked")
    .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
    .limit(10);
  return data ?? [];
}

export async function adjustPlayerBalance(userId: string, delta: number, reason: string, adminNote?: string) {
  const { data: profile } = await supabase.from("profiles").select("balance").eq("id", userId).single();
  if (!profile) throw new Error("Player not found");

  const newBalance = Math.max(0, Number(profile.balance) + delta);
  const { error } = await supabase.from("profiles").update({ balance: newBalance }).eq("id", userId);
  if (error) throw error;

  await supabase.from("transactions").insert({
    user_id: userId,
    type: delta > 0 ? "credit" : "debit",
    amount: Math.abs(delta),
    description: `[Admin] ${reason}${adminNote ? ` — ${adminNote}` : ""}`,
    status: "approved",
  });

  return newBalance;
}

// ─── Block Users ──────────────────────────────────────────────────────────────

export async function listBlockedUsers() {
  const { data } = await supabase
    .from("blocked_users")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });
  return (data ?? []) as AdminBlockedUser[];
}

export async function blockUser(opts: {
  userId: string;
  userName: string;
  blockType: "account" | "ip" | "full";
  reason: string;
  ip?: string;
  adminId: string;
}) {
  await supabase.from("blocked_users").insert({
    user_id: opts.userId,
    user_name: opts.userName,
    block_type: opts.blockType,
    reason: opts.reason,
    blocked_ip: opts.ip,
    is_active: true,
    admin_id: opts.adminId,
  });

  await supabase.from("profiles").update({
    is_blocked: true,
    block_type: opts.blockType,
  }).eq("id", opts.userId);
}

export async function unblockUser(blockId: string, userId: string) {
  await supabase.from("blocked_users").update({
    is_active: false,
    unblocked_at: new Date().toISOString(),
  }).eq("id", blockId);

  await supabase.from("profiles").update({
    is_blocked: false,
    block_type: null,
  }).eq("id", userId);
}

// ─── Platform Settings ────────────────────────────────────────────────────────

export async function getPlatformSettings(): Promise<PlatformSettings> {
  const { data } = await supabase.from("platform_settings").select("key, value");
  const settings: PlatformSettings = {};
  for (const row of data ?? []) {
    settings[row.key] = row.value;
  }
  return settings;
}

export async function updatePlatformSetting(key: string, value: string, adminId: string) {
  const { error } = await supabase.from("platform_settings").upsert({
    key,
    value,
    updated_at: new Date().toISOString(),
    updated_by: adminId,
  });
  if (error) throw error;
}

export async function updateMultipleSettings(settings: Record<string, string>, adminId: string) {
  const rows = Object.entries(settings).map(([key, value]) => ({
    key,
    value,
    updated_at: new Date().toISOString(),
    updated_by: adminId,
  }));
  const { error } = await supabase.from("platform_settings").upsert(rows);
  if (error) throw error;
}
