import { useQuery, useMutation, useQueryClient, useQueryClient as useQC } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useEffect } from "react";

/* ──────────────────────────────────────────────────────────────
   SUPABASE-BACKED ADMIN API
   Drop-in replacement for mock-api.ts — same hook signatures
────────────────────────────────────────────────────────────── */

/* ── Realtime invalidator — subscribes to key tables and
       refreshes queries automatically without page reload ── */
export function useAdminRealtimeSync() {
  const qc = useQC();

  useEffect(() => {
    const channel = supabase
      .channel("admin-realtime-v2")
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, () => {
        qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
        qc.invalidateQueries({ queryKey: ["matches"] });
        qc.invalidateQueries({ queryKey: ["bets"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => {
        qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
        qc.invalidateQueries({ queryKey: ["players"] });
        qc.invalidateQueries({ queryKey: ["online-players-real"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, () => {
        qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
        qc.invalidateQueries({ queryKey: ["withdrawals"] });
        qc.invalidateQueries({ queryKey: ["transactions"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "reports" }, () => {
        qc.invalidateQueries({ queryKey: ["reports"] });
        qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
        qc.invalidateQueries({ queryKey: ["antifraud"] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [qc]);
}

/* ── Dashboard Stats ── */
export function useGetDashboardStats() {
  return useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISO = today.toISOString();

      // Each query runs independently — a missing table returns 0, never crashes
      const safeCount = async (q: Promise<{ count: number | null; error: unknown }>) => {
        try { const r = await q; return r.count ?? 0; } catch { return 0; }
      };
      const safeData = async <T>(q: Promise<{ data: T[] | null; error: unknown }>) => {
        try { const r = await q; return r.data ?? []; } catch { return [] as T[]; }
      };

      const [
        totalPlayers,
        activeBets,
        onlineProfiles,
        pendingWithdrawalsData,
        approvedWithdrawalsData,
        todayWithdrawalsData,
        txToday,
        earningsData,
        earningsTodayData,
        pendingReportsData,
      ] = await Promise.all([
        safeCount(supabase.from("profiles").select("*", { count: "exact", head: true }) as any),
        safeCount(supabase.from("matches").select("*", { count: "exact", head: true })
          .in("status", ["active", "live", "in_progress"]) as any),
        safeData(supabase.from("profiles").select("last_seen_at")
          .gte("last_seen_at", new Date(Date.now() - 2 * 60 * 1000).toISOString()) as any),
        safeData(supabase.from("transactions").select("id")
          .eq("type", "withdrawal").eq("status", "pending") as any),
        safeData(supabase.from("transactions").select("amount")
          .eq("type", "withdrawal").eq("status", "approved") as any),
        safeData(supabase.from("transactions").select("amount")
          .eq("type", "withdrawal").eq("status", "approved")
          .gte("created_at", todayISO) as any),
        safeData(supabase.from("matches").select("id")
          .gte("created_at", todayISO) as any),
        safeData(supabase.from("matches").select("bet_amount")
          .eq("status", "finished") as any),
        safeData(supabase.from("matches").select("bet_amount")
          .eq("status", "finished").gte("created_at", todayISO) as any),
        safeData(supabase.from("reports").select("id").eq("status", "open") as any),
      ]);

      const pendingWithdrawals = (pendingWithdrawalsData as unknown[]).length;
      const totalApprovedWithdrawals = (approvedWithdrawalsData as { amount: number }[])
        .reduce((s, w) => s + Math.abs(Number(w.amount ?? 0)), 0);
      const todaySaidas = (todayWithdrawalsData as { amount: number }[])
        .reduce((s, w) => s + Math.abs(Number(w.amount ?? 0)), 0);
      // 10% da aposta total (bet_amount * 2) por partida terminada
      const platformRevenue = (earningsData as { bet_amount: number }[])
        .reduce((s, m) => s + Number(m.bet_amount ?? 0) * 0.2, 0);
      const todayEarnings = (earningsTodayData as { bet_amount: number }[])
        .reduce((s, m) => s + Number(m.bet_amount ?? 0) * 0.2, 0);

      return {
        liveMatches:              activeBets,
        onlinePlayers:            (onlineProfiles as unknown[]).length,
        activeBets,
        pendingWithdrawals,
        totalPlayers,
        platformRevenue,
        totalApprovedWithdrawals,
        pendingReports:           (pendingReportsData as unknown[]).length,
        todayEarnings,
        todaySaidas,
        todayTransactions:        (txToday as unknown[]).length,
        todayOnline:              (onlineProfiles as unknown[]).length,
      };
    },
    refetchInterval: 8000,
    staleTime: 3000,
  });
}

export function useGetMatchesOverTime() {
  return useQuery({
    queryKey: ["matches-over-time"],
    queryFn: async () => {
      const days: { date: string; dama: number; ludo: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const start = new Date(d); start.setHours(0, 0, 0, 0);
        const end   = new Date(d); end.setHours(23, 59, 59, 999);

        const [{ count: dama }, { count: ludo }] = await Promise.all([
          supabase.from("matches").select("*", { count: "exact", head: true })
            .eq("game_type", "dama").gte("created_at", start.toISOString()).lte("created_at", end.toISOString()),
          supabase.from("matches").select("*", { count: "exact", head: true })
            .eq("game_type", "ludo").gte("created_at", start.toISOString()).lte("created_at", end.toISOString()),
        ]);
        days.push({ date: start.toISOString().slice(0, 10), dama: dama ?? 0, ludo: ludo ?? 0 });
      }
      return days;
    },
    staleTime: 60000,
  });
}

export function useGetBetsOverTime() {
  return useQuery({
    queryKey: ["bets-over-time"],
    queryFn: async () => {
      const days: { date: string; dama: number; ludo: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const start = new Date(d); start.setHours(0, 0, 0, 0);
        const end   = new Date(d); end.setHours(23, 59, 59, 999);

        const [{ data: damaData }, { data: ludoData }] = await Promise.all([
          supabase.from("matches").select("bet_amount")
            .eq("game_type", "dama").gte("created_at", start.toISOString()).lte("created_at", end.toISOString()),
          supabase.from("matches").select("bet_amount")
            .eq("game_type", "ludo").gte("created_at", start.toISOString()).lte("created_at", end.toISOString()),
        ]);
        const dama = (damaData ?? []).reduce((s: number, m: { bet_amount: number }) => s + (m.bet_amount ?? 0), 0);
        const ludo = (ludoData ?? []).reduce((s: number, m: { bet_amount: number }) => s + (m.bet_amount ?? 0), 0);
        days.push({ date: start.toISOString().slice(0, 10), dama, ludo });
      }
      return days;
    },
    staleTime: 60000,
  });
}

export function useGetGameBreakdown() {
  return useQuery({
    queryKey: ["game-breakdown"],
    queryFn: async () => {
      const [
        { count: damaMatches, data: damaData },
        { count: ludoMatches, data: ludoData },
        { count: xadrezMatches, data: xadrezData },
        { count: roletaMatches, data: roletaData },
      ] = await Promise.all([
        supabase.from("matches").select("bet_amount", { count: "exact" }).eq("game_type", "dama"),
        supabase.from("matches").select("bet_amount", { count: "exact" }).eq("game_type", "ludo"),
        supabase.from("matches").select("bet_amount", { count: "exact" }).eq("game_type", "xadrez"),
        supabase.from("matches").select("bet_amount", { count: "exact" }).eq("game_type", "roleta"),
      ]);

      const sum = (arr: { bet_amount: number }[] | null) =>
        (arr ?? []).reduce((s, m) => s + (m.bet_amount ?? 0), 0);

      const dm = damaMatches   ?? 0;
      const lm = ludoMatches   ?? 0;
      const total = dm + lm + (xadrezMatches ?? 0) + (roletaMatches ?? 0);

      return {
        dama:           total > 0 ? Math.round((dm / total) * 100) : 0,
        ludo:           total > 0 ? Math.round((lm / total) * 100) : 0,
        damaMatches:    dm,
        ludoMatches:    lm,
        xadrezMatches:  xadrezMatches  ?? 0,
        roletaMatches:  roletaMatches  ?? 0,
        damaBetVolume:  sum(damaData   as { bet_amount: number }[]),
        ludoBetVolume:  sum(ludoData   as { bet_amount: number }[]),
        xadrezBetVolume: sum(xadrezData as { bet_amount: number }[]),
        roletaBetVolume: sum(roletaData as { bet_amount: number }[]),
      };
    },
    staleTime: 60000,
  });
}

/* ── Matches ── */
export interface AdminMatch {
  id: string;
  game: string;
  player1Name: string;
  player2Name: string;
  betAmount: number;
  status: "live" | "finished" | "pending" | "active";
  winnerName: string | null;
  winnerId: string | null;
  createdAt: string;
  durationSeconds: number | null;
}

function mapMatch(m: Record<string, unknown>): AdminMatch {
  return {
    id:             m.id as string,
    game:           (m.game_type as string) ?? "dama",
    player1Name:    (m.player1_name as string) ?? "—",
    player2Name:    (m.player2_name as string) ?? "—",
    betAmount:      (m.bet_amount as number)   ?? 0,
    status:         (m.status as "live" | "finished" | "pending" | "active") ?? "pending",
    winnerName:     (m.winner_name as string)  ?? null,
    winnerId:       (m.winner_id as string)    ?? null,
    createdAt:      m.created_at as string,
    durationSeconds: null,
  };
}

export function useListMatches(params?: { status?: string; game?: string }) {
  return useQuery({
    queryKey: ["matches", params],
    queryFn: async () => {
      let q = supabase.from("matches").select("*").order("created_at", { ascending: false }).limit(200);
      if (params?.status && params.status !== "all") {
        // "live" or "active" means in-progress matches
        if (params.status === "live" || params.status === "active") {
          q = q.in("status", ["active", "live", "in_progress"]);
        } else {
          q = q.eq("status", params.status);
        }
      }
      if (params?.game && params.game !== "all") q = q.eq("game_type", params.game);
      const { data, error } = await q;
      if (error) return [];
      return (data ?? []).map(m => mapMatch(m as Record<string, unknown>));
    },
    refetchInterval: 10000,
    staleTime: 3000,
  });
}

export function useGetMatch(id: string, _opts?: unknown) {
  return useQuery({
    queryKey: ["match", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase.from("matches").select("*").eq("id", id).single();
      if (error) return null;
      return mapMatch(data as Record<string, unknown>);
    },
  });
}

export function getGetMatchQueryKey(id: string) { return ["match", id]; }

export function useResolveMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { winnerId: string } }) => {
      const { error } = await supabase
        .from("matches")
        .update({ winner_id: data.winnerId, status: "finished", completed_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      return { ok: true };
    },
    onSuccess: (_d, { id }) => {
      qc.invalidateQueries({ queryKey: ["match", id] });
      qc.invalidateQueries({ queryKey: ["matches"] });
    },
  });
}

/* ── Players ── */
export interface AdminPlayer {
  id: string;
  username: string;
  status: "online" | "in_game" | "offline" | "suspended";
  balance: number;
  wins: number;
  losses: number;
  totalBets: number;
  createdAt: string;
  email?: string;
  isBlocked?: boolean;
}

function mapPlayer(p: Record<string, unknown>): AdminPlayer {
  const wins   = (p.total_wins  as number) ?? 0;
  const total  = (p.total_games as number) ?? 0;
  const losses = Math.max(0, total - wins);
  const blocked = (p.is_blocked as boolean) ?? false;

  let status: AdminPlayer["status"] = "offline";
  if (blocked) status = "suspended";
  else if (p.last_seen_at) {
    const diff = Date.now() - new Date(p.last_seen_at as string).getTime();
    if (diff < 5 * 60 * 1000) status = "online";
  }

  return {
    id:         p.id as string,
    username:   (p.username as string)  ?? (p.full_name as string) ?? "utilizador",
    status,
    balance:    (p.balance as number)   ?? 0,
    wins,
    losses,
    totalBets:  0,
    createdAt:  p.created_at as string,
    email:      p.email as string | undefined,
    isBlocked:  blocked,
  };
}

export function useListPlayers() {
  return useQuery({
    queryKey: ["players"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) return [];
      return (data ?? []).map(p => mapPlayer(p as Record<string, unknown>));
    },
    refetchInterval: 30000,
    staleTime: 10000,
  });
}

export function getListPlayersQueryKey() { return ["players"]; }

export function useGetPlayer(id: string, _opts?: unknown) {
  return useQuery({
    queryKey: ["player", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase.from("profiles").select("*").eq("id", id).single();
      if (error) return null;
      return mapPlayer(data as Record<string, unknown>);
    },
  });
}

export function getGetPlayerQueryKey(id: string) { return ["player", id]; }

export function useSuspendPlayer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { reason: string } }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ is_blocked: true, block_type: "account" })
        .eq("id", id);
      if (error) throw error;
      await supabase.from("blocked_users").insert({
        user_id: id,
        block_type: "account",
        reason: data.reason,
        is_active: true,
      });
      return { ok: true };
    },
    onSuccess: (_d, { id }) => {
      qc.invalidateQueries({ queryKey: ["players"] });
      qc.invalidateQueries({ queryKey: ["player", id] });
    },
  });
}

/* ── Bets (treated as matches for now) ── */
export function useListBets(params?: { status?: string }) {
  return useQuery({
    queryKey: ["bets", params],
    queryFn: async () => {
      let q = supabase.from("matches")
        .select("id, game_type, player1_name, player2_name, bet_amount, winner_payout, status, created_at")
        .order("created_at", { ascending: false })
        .limit(100);

      if (params?.status && params.status !== "all") {
        if (params.status === "active")    q = q.in("status", ["active", "pending"]);
        if (params.status === "settled")   q = q.eq("status", "finished");
        if (params.status === "cancelled") q = q.eq("status", "cancelled");
      }

      const { data, error } = await q;
      if (error) return [];
      return (data ?? []).map((m: Record<string, unknown>) => ({
        id:         m.id as string,
        playerName: (m.player1_name as string) ?? "—",
        game:       (m.game_type as string)    ?? "dama",
        matchId:    m.id as string,
        amount:     (m.bet_amount as number)   ?? 0,
        payout:     (m.winner_payout as number) || null,
        status:     mapBetStatus(m.status as string),
        createdAt:  m.created_at as string,
      }));
    },
    refetchInterval: 15000,
    staleTime: 5000,
  });
}

function mapBetStatus(s: string): "active" | "settled" | "cancelled" {
  if (s === "finished") return "settled";
  if (s === "cancelled") return "cancelled";
  return "active";
}

export function getListBetsQueryKey() { return ["bets"]; }

/* ── Transactions (real transactions table) ── */
export interface AdminTransaction {
  id: string;
  playerName: string;
  type: "bet" | "deposit" | "withdrawal" | "win";
  amount: number;
  payout: number | null;
  status: "active" | "settled" | "cancelled" | "pending" | "approved" | "rejected";
  game: string;
  createdAt: string;
}

function parseTxGame(description: unknown): string {
  try {
    const desc = typeof description === "string" ? JSON.parse(description) : null;
    if (desc?.game) return desc.game;
  } catch { /* not JSON */ }
  const s = String(description ?? "");
  if (s.includes("Damas")) return "dama";
  if (s.includes("Ludo"))  return "ludo";
  if (s.includes("Xadrez")) return "xadrez";
  if (s.includes("Roleta")) return "roleta";
  return "—";
}

function mapTxStatus(status: string, type: string): AdminTransaction["status"] {
  if (type === "withdrawal") {
    if (status === "pending")  return "pending";
    if (status === "approved") return "approved";
    if (status === "rejected") return "rejected";
  }
  if (status === "approved") return "settled";
  if (status === "rejected") return "cancelled";
  return "active";
}

export function useListTransactions(params?: { status?: string; type?: string }) {
  return useQuery({
    queryKey: ["transactions", params],
    queryFn: async () => {
      let q = supabase
        .from("transactions")
        .select("id, user_id, type, amount, status, description, created_at")
        .order("created_at", { ascending: false })
        .limit(100);

      if (params?.status && params.status !== "all") {
        const s = params.status;
        if (s === "active")    q = q.eq("status", "pending");
        else if (s === "settled")   q = q.in("status", ["approved"]);
        else if (s === "cancelled") q = q.eq("status", "rejected");
        else q = q.eq("status", s);
      }
      if (params?.type && params.type !== "all") {
        if (params.type === "bet") q = q.in("type", ["bet", "win"]);
        else q = q.eq("type", params.type);
      }

      const { data, error } = await q;
      if (error) return [] as AdminTransaction[];

      const rows = (data ?? []) as Record<string, unknown>[];
      const userIds = [...new Set(rows.map(r => r.user_id as string).filter(Boolean))];

      let profileMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, username, full_name")
          .in("id", userIds);
        profileMap = Object.fromEntries(
          (profiles ?? []).map((p: Record<string, unknown>) => [
            p.id as string,
            (p.username as string) ?? (p.full_name as string) ?? "—",
          ])
        );
      }

      return rows.map(tx => {
        const txType = (tx.type as string) ?? "bet";
        const rawAmount = Number(tx.amount ?? 0);
        const amount = Math.abs(rawAmount);
        return {
          id:         tx.id as string,
          playerName: profileMap[tx.user_id as string] ?? "—",
          type:       (txType === "win" ? "bet" : txType) as AdminTransaction["type"],
          amount,
          payout:     txType === "win" ? amount : null,
          status:     mapTxStatus(tx.status as string, txType),
          game:       parseTxGame(tx.description),
          createdAt:  tx.created_at as string,
        } satisfies AdminTransaction;
      });
    },
    refetchInterval: 10000,
    staleTime: 5000,
  });
}

export function getListTransactionsQueryKey() { return ["transactions"]; }

export function useCancelBet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { error } = await supabase.from("matches").update({ status: "cancelled" }).eq("id", id);
      if (error) throw error;
      return { ok: true };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bets"] }),
  });
}

/* ── Ranking ── */
export function useGetRanking(_params?: { game?: string }) {
  return useQuery({
    queryKey: ["ranking", _params],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, total_wins, total_games, balance")
        .order("total_wins", { ascending: false })
        .limit(50);
      if (error) throw error;

      return (data ?? []).map((p: Record<string, unknown>, i: number) => {
        const wins   = (p.total_wins  as number) ?? 0;
        const total  = (p.total_games as number) ?? 0;
        const losses = Math.max(0, total - wins);
        return {
          playerId:      p.id as string,
          rank:          i + 1,
          username:      (p.username as string) ?? "utilizador",
          wins,
          losses,
          winRate:       total > 0 ? Math.round((wins / total) * 1000) / 10 : 0,
          totalEarnings: (p.balance as number) ?? 0,
        };
      });
    },
    staleTime: 60000,
  });
}

/* ── Reports ── */
export interface AdminReport {
  id: string;
  reporterName: string;
  accusedName: string;
  reason: string;
  description: string;
  matchId: string | null;
  status: "pending" | "reviewed" | "dismissed";
  createdAt: string;
  category?: string;
  priority?: string;
}

function mapReport(r: Record<string, unknown>): AdminReport {
  return {
    id:           r.id as string,
    reporterName: (r.user_name as string)    ?? (r.user_email as string) ?? "utilizador",
    accusedName:  (r.accused_name as string) ?? (r.ticket_id as string)  ?? "—",
    reason:       (r.category as string)     ?? "Outro",
    description:  (r.description as string)  ?? "",
    matchId:      (r.ticket_id as string)    ?? null,
    status:       mapReportStatus(r.status as string),
    createdAt:    r.created_at as string,
    category:     (r.category as string)     ?? "Outro",
    priority:     (r.priority as string)     ?? "Média",
  };
}

function mapReportStatus(s: string): "pending" | "reviewed" | "dismissed" {
  if (s === "open")      return "pending";
  if (s === "resolved")  return "reviewed";
  if (s === "dismissed") return "dismissed";
  return "pending";
}

export function useListReports(params?: { status?: string }) {
  return useQuery({
    queryKey: ["reports", params],
    queryFn: async () => {
      let q = supabase.from("reports").select("*").order("created_at", { ascending: false }).limit(100);
      if (params?.status && params.status !== "all") {
        const dbStatus = params.status === "pending" ? "open" : params.status === "reviewed" ? "resolved" : "dismissed";
        q = q.eq("status", dbStatus);
      }
      const { data, error } = await q;
      if (error) return [];
      return (data ?? []).map(r => mapReport(r as Record<string, unknown>));
    },
    refetchInterval: 30000,
    staleTime: 10000,
  });
}

export function getListReportsQueryKey() { return ["reports"]; }

export function useResolveReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { action: string; notes: string } }) => {
      const dbStatus = data.action === "reviewed" ? "resolved" : "dismissed";
      const { error } = await supabase
        .from("reports")
        .update({ status: dbStatus, admin_notes: data.notes, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      return { ok: true };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reports"] }),
  });
}

/* ── Withdrawals ── */
export interface AdminWithdrawal {
  id: string;
  playerName: string;
  amount: number;
  method: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  phone?: string;
  fee?: number;
  netAmount?: number;
}

function mapWithdrawalStatus(s: string): "pending" | "approved" | "rejected" {
  if (s === "approved") return "approved";
  if (s === "rejected") return "rejected";
  return "pending";
}

function mapWithdrawalFromTx(tx: Record<string, unknown>): AdminWithdrawal {
  const rawAmount = Math.abs(Number(tx.amount ?? 0));
  let meta: { method?: string; phone?: string; userName?: string } = {};
  try { meta = JSON.parse(tx.description as string); } catch { /* plain description */ }
  return {
    id:         tx.id as string,
    playerName: meta.userName ?? "utilizador",
    amount:     rawAmount,
    method:     meta.method ?? "M-Pesa",
    status:     mapWithdrawalStatus(tx.status as string),
    createdAt:  tx.created_at as string,
    phone:      meta.phone ?? undefined,
    fee:        0,
    netAmount:  rawAmount,
  };
}

export function useListWithdrawals(params?: { status?: string }) {
  return useQuery({
    queryKey: ["withdrawals", params],
    queryFn: async () => {
      let q = supabase
        .from("transactions")
        .select("*")
        .eq("type", "withdrawal")
        .order("created_at", { ascending: false })
        .limit(100);
      if (params?.status && params.status !== "all") q = q.eq("status", params.status);
      const { data, error } = await q;
      if (error) return [];
      return (data ?? []).map(tx => mapWithdrawalFromTx(tx as Record<string, unknown>));
    },
    refetchInterval: 8000,
    staleTime: 3000,
  });
}

export function getListWithdrawalsQueryKey() { return ["withdrawals"]; }

export function useApproveWithdrawal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      // Fetch the transaction and verify it's still pending
      const { data: txData, error: fetchErr } = await supabase
        .from("transactions")
        .select("id, status")
        .eq("id", id)
        .single();

      if (fetchErr || !txData) throw new Error("Levantamento não encontrado");
      const tx = txData as Record<string, unknown>;
      if (tx.status !== "pending") throw new Error("Levantamento já processado");

      // Update status to approved
      const { error } = await supabase
        .from("transactions")
        .update({ status: "approved" })
        .eq("id", id);

      if (error) throw new Error(`Erro ao aprovar: ${error.message}`);
      return { ok: true };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["withdrawals"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
  });
}

export function useRejectWithdrawal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data: _data }: { id: string; data: { reason: string } }) => {
      // Fetch the transaction with balance info
      const { data: txData, error: fetchErr } = await supabase
        .from("transactions")
        .select("id, amount, user_id, status")
        .eq("id", id)
        .single();

      if (fetchErr || !txData) throw new Error("Levantamento não encontrado");
      const tx = txData as Record<string, unknown>;
      if (tx.status !== "pending") throw new Error("Levantamento já processado");

      // Update status to rejected
      const { error: updateErr } = await supabase
        .from("transactions")
        .update({ status: "rejected" })
        .eq("id", id);

      if (updateErr) throw new Error(`Erro ao rejeitar: ${updateErr.message}`);

      // Restore user balance (the withdrawal amount is stored as negative)
      const withdrawalAmount = Math.abs(Number(tx.amount ?? 0));
      if (withdrawalAmount > 0 && tx.user_id) {
        const { data: profileData, error: profileErr } = await supabase
          .from("profiles")
          .select("balance")
          .eq("id", tx.user_id as string)
          .single();

        if (!profileErr && profileData) {
          const profile = profileData as Record<string, unknown>;
          const restored = Math.round((Number(profile.balance ?? 0) + withdrawalAmount) * 100) / 100;
          await supabase
            .from("profiles")
            .update({ balance: restored })
            .eq("id", tx.user_id as string);
        }
      }

      return { ok: true };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["withdrawals"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
  });
}

/* ── Anti-Fraud ── */
export function useGetAntiFraudAlerts() {
  return useQuery({
    queryKey: ["antifraud"],
    queryFn: async () => {
      const [
        { data: blocked },
        { data: reports },
        { count: suspicious },
      ] = await Promise.all([
        supabase.from("blocked_users").select("*").eq("is_active", true).limit(50),
        supabase.from("reports").select("*").eq("status", "open").order("created_at", { ascending: false }).limit(20),
        supabase.from("reports").select("*", { count: "exact", head: true }).eq("status", "resolved"),
      ]);

      const alerts = (blocked ?? []).map((b: Record<string, unknown>) => ({
        id:          b.id as string,
        playerName:  (b.user_name as string) ?? "utilizador",
        type:        (b.block_type as string) ?? "account",
        severity:    "high" as const,
        description: (b.reason as string) ?? "Conta bloqueada pelo administrador.",
        createdAt:   b.created_at as string,
      }));

      const reportAlerts = (reports ?? []).slice(0, Math.max(0, 4 - alerts.length)).map((r: Record<string, unknown>) => ({
        id:          r.id as string,
        playerName:  (r.user_name as string)   ?? "utilizador",
        type:        (r.category as string)    ?? "report",
        severity:    ((r.priority as string) === "Urgente" || (r.priority as string) === "Alta") ? "high" as const : "medium" as const,
        description: (r.description as string) ?? "",
        createdAt:   r.created_at as string,
      }));

      return {
        flaggedAccounts:  (blocked ?? []).length,
        suspiciousBets:   suspicious ?? 0,
        unusualPatterns:  (reports ?? []).filter((r: Record<string, unknown>) => r.priority === "Alta" || r.priority === "Urgente").length,
        resolvedToday:    suspicious ?? 0,
        alerts:           [...alerts, ...reportAlerts].slice(0, 4),
      };
    },
    refetchInterval: 30000,
    staleTime: 10000,
  });
}

/* ── Platform Settings ── */
export function useGetPlatformSettings() {
  return useQuery({
    queryKey: ["platform-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("platform_settings").select("*");
      if (error) throw error;
      const map: Record<string, string> = {};
      (data ?? []).forEach((s: { key: string; value: string }) => { map[s.key] = s.value; });
      return map;
    },
    staleTime: 30000,
  });
}

export function useUpdatePlatformSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("platform_settings")
        .update({ value, updated_at: new Date().toISOString(), updated_by: user?.id ?? null })
        .eq("key", key);
      if (error) throw error;
      return { ok: true };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["platform-settings"] }),
  });
}

/* ── Notifications ── */
export function useSendNotification() {
  return useMutation({
    mutationFn: async (payload: {
      title: string;
      subtitle?: string;
      type?: string;
      target?: string;
      targetUserIds?: string[];
      imageUrl?: string;
      actionButtonLabel?: string;
      actionButtonUrl?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("notifications").insert({
        title:               payload.title,
        subtitle:            payload.subtitle ?? null,
        type:                payload.type ?? "notification",
        target:              payload.target ?? "all",
        target_user_ids:     payload.targetUserIds ?? null,
        image_url:           payload.imageUrl ?? null,
        action_button_label: payload.actionButtonLabel ?? null,
        action_button_url:   payload.actionButtonUrl ?? null,
        sent_by:             user?.id ?? null,
      });
      if (error) throw error;
      return { ok: true };
    },
  });
}

export function useGetNotificationHistory() {
  return useQuery({
    queryKey: ["notification-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 30000,
    staleTime: 10000,
  });
}

/* ── Support Messages ── */
export interface SupportConversation {
  userId: string;
  userName: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  lastSender: "user" | "admin" | "ai";
}

export interface SupportMessage {
  id: string;
  userId: string;
  userName: string;
  sender: "user" | "admin" | "ai";
  content: string;
  createdAt: string;
  readByAdmin: boolean;
}

export function useListSupportConversations() {
  return useQuery({
    queryKey: ["support-conversations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_messages")
        .select("user_id, user_name, sender, content, created_at, read_by_admin")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;

      const convMap = new Map<string, SupportConversation>();
      (data ?? []).forEach((m: Record<string, unknown>) => {
        const uid = m.user_id as string;
        if (!convMap.has(uid)) {
          convMap.set(uid, {
            userId: uid,
            userName: (m.user_name as string) ?? "utilizador",
            lastMessage: (m.content as string) ?? "",
            lastMessageTime: m.created_at as string,
            unreadCount: 0,
            lastSender: (m.sender as "user" | "admin" | "ai") ?? "user",
          });
        }
        if (m.sender === "user" && !m.read_by_admin) {
          const conv = convMap.get(uid)!;
          conv.unreadCount++;
          convMap.set(uid, conv);
        }
      });

      return Array.from(convMap.values()).sort(
        (a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime()
      );
    },
    refetchInterval: 10000,
    staleTime: 3000,
  });
}

export function useGetSupportMessages(userId: string | null) {
  return useQuery({
    queryKey: ["support-messages", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("support_messages")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((m: Record<string, unknown>) => ({
        id: m.id as string,
        userId: m.user_id as string,
        userName: (m.user_name as string) ?? "utilizador",
        sender: (m.sender as "user" | "admin" | "ai") ?? "user",
        content: (m.content as string) ?? "",
        createdAt: m.created_at as string,
        readByAdmin: (m.read_by_admin as boolean) ?? false,
      }));
    },
    enabled: !!userId,
    refetchInterval: 8000,
    staleTime: 2000,
  });
}

export function useSendAdminSupportMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, userName, content }: { userId: string; userName: string; content: string }) => {
      const { error } = await supabase.from("support_messages").insert({
        user_id: userId,
        user_name: userName,
        sender: "admin",
        content,
        read_by_admin: true,
      });
      if (error) throw error;
      return { ok: true };
    },
    onSuccess: (_d, { userId }) => {
      qc.invalidateQueries({ queryKey: ["support-messages", userId] });
      qc.invalidateQueries({ queryKey: ["support-conversations"] });
    },
  });
}

export function useMarkSupportMessagesRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from("support_messages")
        .update({ read_by_admin: true })
        .eq("user_id", userId)
        .eq("read_by_admin", false);
      if (error) throw error;
      return { ok: true };
    },
    onSuccess: (_d, userId) => {
      qc.invalidateQueries({ queryKey: ["support-conversations"] });
      qc.invalidateQueries({ queryKey: ["support-messages", userId] });
    },
  });
}

/* ── User-side Notifications ── */
export interface UserNotification {
  id: string;
  title: string;
  subtitle: string;
  type: string;
  imageUrl: string | null;
  actionButtonLabel: string | null;
  actionButtonUrl: string | null;
  createdAt: string;
  isRead: boolean;
}

export function useGetUserNotifications(userId: string | null) {
  return useQuery({
    queryKey: ["user-notifications", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;

      const all = (data ?? []).filter((n: Record<string, unknown>) => {
        if (n.target === "all") return true;
        if (n.target === "specific") {
          const ids = n.target_user_ids as string[] | null;
          return Array.isArray(ids) && ids.includes(userId);
        }
        return false;
      });

      if (all.length === 0) return [];
      const ids = all.map((n: Record<string, unknown>) => n.id as string);

      const { data: reads } = await supabase
        .from("notification_reads")
        .select("notification_id")
        .eq("user_id", userId)
        .in("notification_id", ids);

      const readSet = new Set((reads ?? []).map((r: Record<string, unknown>) => r.notification_id as string));

      return all.map((n: Record<string, unknown>): UserNotification => ({
        id: n.id as string,
        title: n.title as string,
        subtitle: (n.subtitle as string) ?? "",
        type: (n.type as string) ?? "notification",
        imageUrl: n.image_url as string | null,
        actionButtonLabel: n.action_button_label as string | null,
        actionButtonUrl: n.action_button_url as string | null,
        createdAt: n.created_at as string,
        isRead: readSet.has(n.id as string),
      }));
    },
    enabled: !!userId,
    refetchInterval: 30000,
    staleTime: 10000,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ notificationId, userId }: { notificationId: string; userId: string }) => {
      const { error } = await supabase
        .from("notification_reads")
        .upsert(
          { notification_id: notificationId, user_id: userId, read_at: new Date().toISOString() },
          { onConflict: "notification_id,user_id" }
        );
      if (error) throw error;
      return { ok: true };
    },
    onSuccess: (_d, { userId }) => {
      qc.invalidateQueries({ queryKey: ["user-notifications", userId] });
    },
  });
}
