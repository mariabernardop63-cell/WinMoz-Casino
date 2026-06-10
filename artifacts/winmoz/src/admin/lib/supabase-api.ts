import { useQuery, useMutation, useQueryClient, useQueryClient as useQC } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { createClient } from "@supabase/supabase-js";
import { useEffect } from "react";

const _adminUrl = (import.meta.env.VITE_SUPABASE_URL as string) || "https://placeholder.supabase.co";
// Use service role key for admin operations — required to bypass RLS and read all users' data
const _adminKey = (import.meta.env.VITE_SUPABASE_SERVICE_ROLE as string)
  || (import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY as string)
  || (import.meta.env.VITE_SUPABASE_ANON_KEY as string)
  || "placeholder";
export const adminSupabase = createClient(_adminUrl, _adminKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
    storageKey: "sb-admin-isolated",
  },
});

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

/* ── Admin DB reset functions ── */
export async function resetPlatformRevenue() {
  const res = await fetch("/api/admin/settings/set", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key: "revenue_reset_at", value: new Date().toISOString() }),
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({ error: "Erro desconhecido" })) as { error?: string };
    throw new Error(d.error ?? "Erro ao repor receita");
  }
}

export async function resetSaidas() {
  const res = await fetch("/api/admin/settings/set", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key: "saidas_reset_at", value: new Date().toISOString() }),
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({ error: "Erro desconhecido" })) as { error?: string };
    throw new Error(d.error ?? "Erro ao repor saídas");
  }
}

/* ── Dashboard Stats ── */
export function useGetDashboardStats() {
  return useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISO = today.toISOString();

      const safeCount = async (q: Promise<{ count: number | null; error: unknown }>) => {
        try { const r = await q; return r.count ?? 0; } catch { return 0; }
      };
      const safeData = async <T>(q: Promise<{ data: T[] | null; error: unknown }>) => {
        try { const r = await q; return r.data ?? []; } catch { return [] as T[]; }
      };

      // Verificar se há resets do admin (guardados em platform_settings)
      const [revenueResetRes, withdrawalsResetRes] = await Promise.all([
        adminSupabase.from("platform_settings").select("value").eq("key", "revenue_reset_at").maybeSingle(),
        adminSupabase.from("platform_settings").select("value").eq("key", "saidas_reset_at").maybeSingle(),
      ]);
      const revenueResetAt: string | null = (revenueResetRes.data as { value: string } | null)?.value ?? null;
      const withdrawalsResetAt: string | null = (withdrawalsResetRes.data as { value: string } | null)?.value ?? null;

      // Construir queries com filtro de reset se aplicável
      const betsQ = adminSupabase.from("transactions").select("amount")
        .eq("type", "bet").eq("status", "approved");
      const winsQ = adminSupabase.from("transactions").select("amount")
        .eq("type", "win").eq("status", "approved");
      const approvWdQ = adminSupabase.from("transactions").select("amount")
        .eq("type", "withdrawal").eq("status", "approved");

      const [
        totalPlayers,
        onlineProfiles,
        pendingWithdrawalsData,
        approvedWithdrawalsData,
        todayWithdrawalsData,
        txToday,
        allBetsData,
        allWinsData,
        todayBetsData,
        todayWinsData,
        pendingReportsData,
      ] = await Promise.all([
        safeCount(adminSupabase.from("profiles").select("*", { count: "exact", head: true }) as any),
        safeData(adminSupabase.from("profiles").select("last_seen_at")
          .gte("last_seen_at", new Date(Date.now() - 2 * 60 * 1000).toISOString()) as any),
        safeData(adminSupabase.from("transactions").select("id")
          .eq("type", "withdrawal").eq("status", "pending") as any),
        safeData((withdrawalsResetAt ? approvWdQ.gte("created_at", withdrawalsResetAt) : approvWdQ) as any),
        safeData(adminSupabase.from("transactions").select("amount")
          .eq("type", "withdrawal").eq("status", "approved")
          .gte("created_at", todayISO) as any),
        safeData(adminSupabase.from("transactions").select("id")
          .eq("type", "bet").gte("created_at", todayISO) as any),
        safeData((revenueResetAt ? betsQ.gte("created_at", revenueResetAt) : betsQ) as any),
        safeData((revenueResetAt ? winsQ.gte("created_at", revenueResetAt) : winsQ) as any),
        safeData(adminSupabase.from("transactions").select("amount")
          .eq("type", "bet").eq("status", "approved")
          .gte("created_at", todayISO) as any),
        safeData(adminSupabase.from("transactions").select("amount")
          .eq("type", "win").eq("status", "approved")
          .gte("created_at", todayISO) as any),
        safeData(adminSupabase.from("reports").select("id").eq("status", "open") as any),
      ]);

      const pendingWithdrawals = (pendingWithdrawalsData as unknown[]).length;
      const approvedWithdrawalCount = (approvedWithdrawalsData as { amount: number }[]).length;
      const totalApprovedWithdrawals = (approvedWithdrawalsData as { amount: number }[])
        .reduce((s, w) => s + Math.abs(Number(w.amount ?? 0)), 0);
      const todaySaidas = (todayWithdrawalsData as { amount: number }[])
        .reduce((s, w) => s + Math.abs(Number(w.amount ?? 0)), 0);

      // Receita da plataforma = total apostado - total pago aos vencedores + taxas de levantamento (5 MT cada)
      const totalBets = (allBetsData as { amount: number }[])
        .reduce((s, t) => s + Math.abs(Number(t.amount ?? 0)), 0);
      const totalWins = (allWinsData as { amount: number }[])
        .reduce((s, t) => s + Math.abs(Number(t.amount ?? 0)), 0);
      const totalWithdrawalFees = approvedWithdrawalCount * 5;
      const platformRevenue = Math.max(0, totalBets - totalWins + totalWithdrawalFees);

      const todayBets = (todayBetsData as { amount: number }[])
        .reduce((s, t) => s + Math.abs(Number(t.amount ?? 0)), 0);
      const todayWins = (todayWinsData as { amount: number }[])
        .reduce((s, t) => s + Math.abs(Number(t.amount ?? 0)), 0);
      const todayEarnings = Math.max(0, todayBets - todayWins);

      // Active bets: pending bet transactions (game in progress)
      const activeBets = (txToday as unknown[]).length;

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
          adminSupabase.from("transactions").select("*", { count: "exact", head: true })
            .eq("type", "bet").ilike("description", "%Dama%")
            .gte("created_at", start.toISOString()).lte("created_at", end.toISOString()),
          adminSupabase.from("transactions").select("*", { count: "exact", head: true })
            .eq("type", "bet").ilike("description", "%Ludo%")
            .gte("created_at", start.toISOString()).lte("created_at", end.toISOString()),
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
          adminSupabase.from("transactions").select("amount")
            .eq("type", "bet").ilike("description", "%Dama%")
            .gte("created_at", start.toISOString()).lte("created_at", end.toISOString()),
          adminSupabase.from("transactions").select("amount")
            .eq("type", "bet").ilike("description", "%Ludo%")
            .gte("created_at", start.toISOString()).lte("created_at", end.toISOString()),
        ]);
        const dama = (damaData ?? []).reduce((s: number, m: { amount: number }) => s + Math.abs(m.amount ?? 0), 0);
        const ludo = (ludoData ?? []).reduce((s: number, m: { amount: number }) => s + Math.abs(m.amount ?? 0), 0);
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
        adminSupabase.from("transactions").select("amount", { count: "exact" }).eq("type", "bet").ilike("description", "%Dama%"),
        adminSupabase.from("transactions").select("amount", { count: "exact" }).eq("type", "bet").ilike("description", "%Ludo%"),
        adminSupabase.from("transactions").select("amount", { count: "exact" }).eq("type", "bet").ilike("description", "%Xadrez%"),
        adminSupabase.from("transactions").select("amount", { count: "exact" }).eq("type", "bet").ilike("description", "%Roleta%"),
      ]);

      const sum = (arr: { amount: number }[] | null) =>
        (arr ?? []).reduce((s, m) => s + Math.abs(m.amount ?? 0), 0);

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
        damaBetVolume:  sum(damaData   as { amount: number }[]),
        ludoBetVolume:  sum(ludoData   as { amount: number }[]),
        xadrezBetVolume: sum(xadrezData as { amount: number }[]),
        roletaBetVolume: sum(roletaData as { amount: number }[]),
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

function parseTxGameType(description: string): string {
  const d = (description ?? "").toLowerCase();
  if (d.includes("xadrez")) return "xadrez";
  if (d.includes("ludo"))   return "ludo";
  if (d.includes("roleta")) return "roleta";
  if (d.includes("dama") || d.includes("damas")) return "dama";
  return "dama";
}

export function useListMatches(params?: { status?: string; game?: string }) {
  return useQuery({
    queryKey: ["matches", params],
    queryFn: async () => {
      // Reconstruct matches from transaction pairs (bets within ~60s of each other)
      const [{ data: bets }, { data: wins }, { data: profiles }] = await Promise.all([
        adminSupabase.from("transactions")
          .select("id, user_id, amount, description, created_at")
          .eq("type", "bet").eq("status", "approved")
          .order("created_at", { ascending: true })
          .limit(600),
        adminSupabase.from("transactions")
          .select("id, user_id, amount, description, created_at")
          .eq("type", "win").eq("status", "approved"),
        adminSupabase.from("profiles")
          .select("id, full_name, phone"),
      ]);

      const profileName = (id: string) => {
        const p = (profiles ?? []).find((x: Record<string, unknown>) => x.id === id);
        return (p as Record<string, unknown> | undefined)?.full_name as string
          || (p as Record<string, unknown> | undefined)?.phone as string
          || "—";
      };

      const matched = new Set<string>();
      const matchList: AdminMatch[] = [];
      const sortedBets = (bets ?? []) as Record<string, unknown>[];

      for (let i = 0; i < sortedBets.length; i++) {
        if (matched.has(sortedBets[i].id as string)) continue;
        const b1 = sortedBets[i];
        const game = parseTxGameType(b1.description as string);
        const t1 = new Date(b1.created_at as string).getTime();
        const amt1 = Math.abs(Number(b1.amount));

        // Look for a second bet from a different user within 60 seconds, same amount & game
        let b2: Record<string, unknown> | null = null;
        for (let j = i + 1; j < sortedBets.length; j++) {
          if (matched.has(sortedBets[j].id as string)) continue;
          const b = sortedBets[j];
          const timeDiff = Math.abs(new Date(b.created_at as string).getTime() - t1);
          if (timeDiff > 60000) break;
          if (
            b.user_id !== b1.user_id &&
            Math.abs(Number(b.amount)) === amt1 &&
            parseTxGameType(b.description as string) === game
          ) {
            b2 = b;
            break;
          }
        }

        if (b2) {
          matched.add(b1.id as string);
          matched.add(b2.id as string);

          // Find win transaction for this match (within 10 minutes after bets)
          const winTx = (wins ?? []).find((w: Record<string, unknown>) => {
            const wt = new Date(w.created_at as string).getTime();
            const delta = wt - t1;
            return (w.user_id === b1.user_id || w.user_id === b2!.user_id)
              && delta >= -5000 && delta <= 600000;
          }) as Record<string, unknown> | undefined;

          const status: AdminMatch["status"] = winTx ? "finished" : "active";
          matchList.push({
            id: b1.id as string,
            game,
            player1Name: profileName(b1.user_id as string),
            player2Name: profileName(b2.user_id as string),
            betAmount: amt1,
            status,
            winnerName: winTx ? profileName(winTx.user_id as string) : null,
            winnerId: (winTx?.user_id as string) ?? null,
            createdAt: b1.created_at as string,
            durationSeconds: winTx
              ? Math.round((new Date(winTx.created_at as string).getTime() - t1) / 1000)
              : null,
          });
        } else {
          // Solo bet (creating or waiting for opponent)
          matched.add(b1.id as string);
          matchList.push({
            id: b1.id as string,
            game,
            player1Name: profileName(b1.user_id as string),
            player2Name: "—",
            betAmount: amt1,
            status: "pending",
            winnerName: null,
            winnerId: null,
            createdAt: b1.created_at as string,
            durationSeconds: null,
          });
        }
      }

      // Most recent first
      let result = matchList.reverse();

      if (params?.status && params.status !== "all") {
        const fs = params.status;
        if (fs === "live" || fs === "active") {
          // Só mostrar partidas "active" com menos de 30 minutos (evita partidas antigas como "em curso")
          const thirtyMinsAgo = Date.now() - 30 * 60 * 1000;
          result = result.filter(m =>
            m.status === "active" &&
            new Date(m.createdAt).getTime() > thirtyMinsAgo
          );
        } else if (fs === "finished") {
          result = result.filter(m => m.status === "finished");
        } else if (fs === "pending") {
          result = result.filter(m => m.status === "pending");
        } else if (fs === "cancelled") {
          result = result.filter(m => (m.status as string) === "cancelled");
        }
      }
      if (params?.game && params.game !== "all") {
        result = result.filter(m => m.game === params.game);
      }

      return result;
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
      const { data, error } = await adminSupabase.from("matches").select("*").eq("id", id).single();
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
    username:   (p.full_name as string) ?? (p.phone as string) ?? "utilizador",
    status,
    balance:    (p.balance as number)   ?? 0,
    wins,
    losses,
    totalBets:  0,
    createdAt:  p.created_at as string,
    email:      (p.phone as string | undefined),
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
      const { data, error } = await adminSupabase.from("profiles").select("*").eq("id", id).single();
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
      const { error } = await adminSupabase
        .from("profiles")
        .update({ is_blocked: true, block_type: "account" })
        .eq("id", id);
      if (error) throw error;
      await adminSupabase.from("blocked_users").insert({
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

/* ── Bets (from transactions table) ── */
export function useListBets(params?: { status?: string }) {
  return useQuery({
    queryKey: ["bets", params],
    queryFn: async () => {
      let q = adminSupabase.from("transactions")
        .select("id, user_id, type, amount, description, status, created_at")
        .in("type", ["bet", "win"])
        .order("created_at", { ascending: false })
        .limit(100);

      if (params?.status && params.status !== "all") {
        if (params.status === "active")    q = q.eq("status", "pending");
        if (params.status === "settled")   q = q.eq("status", "approved");
        if (params.status === "cancelled") q = q.eq("status", "rejected");
      }

      const { data, error } = await q;
      if (error) return [];

      const rows = (data ?? []) as Record<string, unknown>[];
      const userIds = [...new Set(rows.map(r => r.user_id as string).filter(Boolean))];
      let profileMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await adminSupabase.from("profiles").select("id, full_name, phone").in("id", userIds);
        profileMap = Object.fromEntries(
          (profiles ?? []).map((p: Record<string, unknown>) => [
            p.id as string,
            (p.full_name as string) ?? (p.phone as string) ?? "—",
          ])
        );
      }

      return rows.map((m: Record<string, unknown>) => ({
        id:         m.id as string,
        playerName: profileMap[m.user_id as string] ?? "—",
        game:       parseTxGame(m.description),
        matchId:    m.id as string,
        amount:     Math.abs(Number(m.amount ?? 0)),
        payout:     (m.type as string) === "win" ? Math.abs(Number(m.amount ?? 0)) : null,
        status:     mapBetStatus((m.status as string) === "approved" ? "finished" : (m.status as string)),
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
  phone?: string | null;
}

function parseWithdrawalPhone(description: unknown): string | null {
  if (!description) return null;
  try {
    const desc = typeof description === "string" ? JSON.parse(description) : null;
    if (desc?.phone) return String(desc.phone);
  } catch { /* not JSON */ }
  return null;
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
      let q = adminSupabase
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
        const { data: profiles } = await adminSupabase
          .from("profiles")
          .select("id, full_name, phone")
          .in("id", userIds);
        profileMap = Object.fromEntries(
          (profiles ?? []).map((p: Record<string, unknown>) => [
            p.id as string,
            (p.full_name as string) ?? (p.phone as string) ?? "—",
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
          phone:      txType === "withdrawal" ? parseWithdrawalPhone(tx.description) : null,
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
      const { error } = await adminSupabase.from("transactions").update({ status: "rejected" }).eq("id", id);
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
      const { data, error } = await adminSupabase
        .from("profiles")
        .select("id, full_name, phone, total_wins, total_games, balance")
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
          username:      (p.full_name as string) ?? (p.phone as string) ?? "utilizador",
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
    accusedName:  "—",
    reason:       (r.category as string)     ?? "Outro",
    description:  (r.description as string)  ?? "",
    matchId:      null,
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
      let q = adminSupabase.from("reports").select("*").order("created_at", { ascending: false }).limit(100);
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
      const { error } = await adminSupabase
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
      let q = adminSupabase
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
      const { data: txData, error: fetchErr } = await adminSupabase
        .from("transactions")
        .select("id, status")
        .eq("id", id)
        .single();

      if (fetchErr || !txData) throw new Error("Levantamento não encontrado");
      const tx = txData as Record<string, unknown>;
      if (tx.status !== "pending") throw new Error("Levantamento já processado");

      // Update status to approved
      const { error } = await adminSupabase
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
      const { data: txData, error: fetchErr } = await adminSupabase
        .from("transactions")
        .select("id, amount, user_id, status")
        .eq("id", id)
        .single();

      if (fetchErr || !txData) throw new Error("Levantamento não encontrado");
      const tx = txData as Record<string, unknown>;
      if (tx.status !== "pending") throw new Error("Levantamento já processado");

      // Update status to rejected
      const { error: updateErr } = await adminSupabase
        .from("transactions")
        .update({ status: "rejected" })
        .eq("id", id);

      if (updateErr) throw new Error(`Erro ao rejeitar: ${updateErr.message}`);

      // Restore user balance (the withdrawal amount is stored as negative)
      const withdrawalAmount = Math.abs(Number(tx.amount ?? 0));
      if (withdrawalAmount > 0 && tx.user_id) {
        const { data: profileData, error: profileErr } = await adminSupabase
          .from("profiles")
          .select("balance")
          .eq("id", tx.user_id as string)
          .single();

        if (!profileErr && profileData) {
          const profile = profileData as Record<string, unknown>;
          const restored = Math.round((Number(profile.balance ?? 0) + withdrawalAmount) * 100) / 100;
          await adminSupabase
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
        adminSupabase.from("blocked_users").select("*").eq("is_active", true).limit(50),
        adminSupabase.from("reports").select("*").eq("status", "open").order("created_at", { ascending: false }).limit(20),
        adminSupabase.from("reports").select("*", { count: "exact", head: true }).eq("status", "resolved"),
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
      const { data, error } = await adminSupabase
        .from("platform_settings")
        .select("key, value");
      if (error) throw new Error(error.message);
      const map: Record<string, string> = {};
      (data ?? []).forEach((row: { key: string; value: string }) => {
        map[row.key] = row.value;
      });
      return map;
    },
    staleTime: 10000,
  });
}

export function useUpdatePlatformSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      // Usa o endpoint do api-server (service role no servidor) para garantir que RLS não bloqueia
      const res = await fetch("/api/admin/settings/set", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({ error: "Erro desconhecido" })) as { error?: string };
        throw new Error(d.error ?? "Erro ao guardar definição");
      }
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
      const { error } = await adminSupabase.from("notifications").insert({
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
      const { data, error } = await adminSupabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 15000,
    staleTime: 5000,
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
      const res = await fetch("/api/admin/support/conversations");
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Erro ${res.status}: ${body}`);
      }
      const data = await res.json() as { conversations?: SupportConversation[] };
      return data.conversations ?? [];
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
      const res = await fetch(`/api/admin/support/messages?userId=${encodeURIComponent(userId)}`);
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Erro ${res.status}: ${body}`);
      }
      const data = await res.json() as { messages?: SupportMessage[] };
      return data.messages ?? [];
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
      const res = await fetch("/api/admin/support/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, userName, content }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Erro ao enviar mensagem ${res.status}: ${body}`);
      }
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
      // support_messages table has no read_by_admin column — just refresh queries
      return { ok: true, userId };
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

export function useGetUserNotifications(userId: string | null, userCreatedAt?: string | null) {
  return useQuery({
    queryKey: ["user-notifications", userId, userCreatedAt],
    queryFn: async () => {
      if (!userId) return [];
      let q = adminSupabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (userCreatedAt) q = q.gte("created_at", userCreatedAt);
      const { data, error } = await q;
      if (error) throw error;

      const all = (data ?? []).filter((n: Record<string, unknown>) => {
        if (n.target === "all")    return true;
        if (n.target === "online") return true;
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
    refetchInterval: 8000,
    staleTime: 3000,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ notificationId, userId }: { notificationId: string; userId: string }) => {
      const { error } = await adminSupabase
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

/* ── Block Users ── */
export interface BlockedProfile {
  id: string;
  name: string;
  phone: string;
  blockType: "account" | "ip" | "device";
  blockedAt: string;
  severity: "high" | "medium" | "low";
}

export function useListBlockedUsers() {
  return useQuery({
    queryKey: ["blocked-users"],
    queryFn: async () => {
      const { data, error } = await adminSupabase
        .from("profiles")
        .select("id, full_name, phone, block_type, is_blocked, updated_at")
        .eq("is_blocked", true)
        .order("updated_at", { ascending: false });
      if (error) return [];
      return (data ?? []).map((p: Record<string, unknown>): BlockedProfile => ({
        id:        p.id as string,
        name:      (p.full_name as string) || (p.phone as string) || "Utilizador",
        phone:     (p.phone as string) || "—",
        blockType: ((p.block_type as string) as "account" | "ip" | "device") || "account",
        blockedAt: (p.updated_at as string) || new Date().toISOString(),
        severity:  "medium",
      }));
    },
    refetchInterval: 20000,
    staleTime: 8000,
  });
}

export function useBlockUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, blockType }: { userId: string; blockType: string }) => {
      const { error } = await adminSupabase
        .from("profiles")
        .update({ is_blocked: true, block_type: blockType })
        .eq("id", userId);
      if (error) throw error;
      return { ok: true };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["blocked-users"] }),
  });
}

export function useUnblockUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await adminSupabase
        .from("profiles")
        .update({ is_blocked: false, block_type: null })
        .eq("id", userId);
      if (error) throw error;
      return { ok: true };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["blocked-users"] }),
  });
}

export function useSearchProfilesForBlock(query: string) {
  return useQuery({
    queryKey: ["search-profiles-block", query],
    queryFn: async () => {
      if (query.trim().length < 2) return [];
      const { data, error } = await adminSupabase
        .from("profiles")
        .select("id, full_name, phone, is_blocked, block_type, avatar_url")
        .or(`full_name.ilike.%${query}%,phone.ilike.%${query}%`)
        .limit(8);
      if (error) return [];
      return (data ?? []).map((p: Record<string, unknown>) => ({
        id:        p.id as string,
        name:      (p.full_name as string) || (p.phone as string) || "Utilizador",
        phone:     (p.phone as string) || "—",
        isBlocked: (p.is_blocked as boolean) || false,
        blockType: (p.block_type as string) || null,
        avatarUrl: (p.avatar_url as string) || null,
      }));
    },
    enabled: query.trim().length >= 2,
    staleTime: 5000,
  });
}
