import { useQuery, useMutation, type UseQueryOptions } from "@tanstack/react-query";
import { api } from "./api";

// ─── Query key helpers ────────────────────────────────────────────────────────

export const getListBetsQueryKey        = (p?: object) => ["bets", p]         as const;
export const getGetMatchQueryKey        = (id: number) => ["matches", id]     as const;
export const getListPlayersQueryKey     = (p?: object) => ["players", p]      as const;
export const getGetPlayerQueryKey       = (id: number) => ["players", id]     as const;
export const getListReportsQueryKey     = (p?: object) => ["reports", p]      as const;
export const getListWithdrawalsQueryKey = (p?: object) => ["withdrawals", p]  as const;

function qs(params?: Record<string, string>): string {
  if (!params || !Object.keys(params).length) return "";
  return "?" + new URLSearchParams(params).toString();
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export function useGetDashboardStats() {
  return useQuery({ queryKey: ["stats", "dashboard"],          queryFn: () => api.get<any>("/stats/dashboard"),           refetchInterval: 30_000 });
}
export function useGetMatchesOverTime() {
  return useQuery({ queryKey: ["stats", "matches-over-time"],  queryFn: () => api.get<any[]>("/stats/matches-over-time"), refetchInterval: 60_000 });
}
export function useGetBetsOverTime() {
  return useQuery({ queryKey: ["stats", "bets-over-time"],     queryFn: () => api.get<any[]>("/stats/bets-over-time"),    refetchInterval: 60_000 });
}
export function useGetGameBreakdown() {
  return useQuery({ queryKey: ["stats", "game-breakdown"],     queryFn: () => api.get<any>("/stats/game-breakdown"),      refetchInterval: 60_000 });
}
export function useGetAntiFraudAlerts() {
  return useQuery({ queryKey: ["stats", "antifraud"],          queryFn: () => api.get<any>("/stats/antifraud"),           refetchInterval: 30_000 });
}

// ─── Matches ──────────────────────────────────────────────────────────────────

export function useListMatches(params?: Record<string, string>) {
  return useQuery({ queryKey: ["matches", params], queryFn: () => api.get<any[]>(`/matches${qs(params)}`), refetchInterval: 30_000 });
}
export function useGetMatch(id: number, options?: { query?: Partial<UseQueryOptions<any>> }) {
  return useQuery({ queryKey: getGetMatchQueryKey(id), queryFn: () => api.get<any>(`/matches/${id}`), enabled: !!id, ...options?.query });
}
export function useResolveMatch() {
  return useMutation({ mutationFn: ({ id, data }: { id: number; data: { winnerId: number } }) => api.put(`/matches/${id}/resolve`, data) });
}

// ─── Players ──────────────────────────────────────────────────────────────────

export function useListPlayers(params?: Record<string, string>) {
  return useQuery({ queryKey: ["players", params], queryFn: () => api.get<any[]>(`/players${qs(params)}`), refetchInterval: 30_000 });
}
export function useGetPlayer(id: number, options?: { query?: Partial<UseQueryOptions<any>> }) {
  return useQuery({ queryKey: getGetPlayerQueryKey(id), queryFn: () => api.get<any>(`/players/${id}`), enabled: !!id, ...options?.query });
}
export function useSuspendPlayer() {
  return useMutation({ mutationFn: ({ id, data }: { id: number; data: { reason: string } }) => api.post(`/players/${id}/suspend`, data) });
}

// ─── Bets ─────────────────────────────────────────────────────────────────────

export function useListBets(params?: Record<string, string>) {
  return useQuery({ queryKey: ["bets", params], queryFn: () => api.get<any[]>(`/bets${qs(params)}`), refetchInterval: 30_000 });
}
export function useCancelBet() {
  return useMutation({ mutationFn: ({ id }: { id: number }) => api.post(`/bets/${id}/cancel`, {}) });
}

// ─── Ranking ──────────────────────────────────────────────────────────────────

export function useGetRanking() {
  return useQuery({ queryKey: ["ranking"], queryFn: () => api.get<any[]>("/ranking"), refetchInterval: 60_000 });
}

// ─── Reports ──────────────────────────────────────────────────────────────────

export function useListReports(params?: Record<string, string>) {
  return useQuery({ queryKey: ["reports", params], queryFn: () => api.get<any[]>(`/reports${qs(params)}`), refetchInterval: 30_000 });
}
export function useResolveReport() {
  return useMutation({ mutationFn: ({ id, data }: { id: number; data?: Record<string, unknown> }) => api.post(`/reports/${id}/resolve`, data ?? {}) });
}

// ─── Withdrawals ──────────────────────────────────────────────────────────────

export function useListWithdrawals(params?: Record<string, string>) {
  return useQuery({ queryKey: ["withdrawals", params], queryFn: () => api.get<any[]>(`/withdrawals${qs(params)}`), refetchInterval: 30_000 });
}
export function useApproveWithdrawal() {
  return useMutation({ mutationFn: ({ id }: { id: number }) => api.post(`/withdrawals/${id}/approve`, {}) });
}
export function useRejectWithdrawal() {
  return useMutation({ mutationFn: ({ id, data }: { id: number; data?: { reason?: string } }) => api.post(`/withdrawals/${id}/reject`, data ?? {}) });
}
