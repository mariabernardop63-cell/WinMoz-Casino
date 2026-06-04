import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

/* ──────────────────────────────────────────
   MOCK DATA
────────────────────────────────────────── */

const MOCK_STATS = {
  liveMatches: 14,
  onlinePlayers: 87,
  activeBets: 32,
  pendingWithdrawals: 6,
  totalPlayers: 1248,
  registeredToday: 12,
  platformRevenue: 48320.75,
  totalBetVolume: 152400.50,
  pendingReports: 3,
};

const MOCK_MATCHES_OVER_TIME = [
  { date: "2026-05-29", dama: 42, ludo: 28 },
  { date: "2026-05-30", dama: 38, ludo: 35 },
  { date: "2026-05-31", dama: 55, ludo: 41 },
  { date: "2026-06-01", dama: 61, ludo: 49 },
  { date: "2026-06-02", dama: 47, ludo: 38 },
  { date: "2026-06-03", dama: 73, ludo: 52 },
  { date: "2026-06-04", dama: 68, ludo: 44 },
];

const MOCK_BETS_OVER_TIME = [
  { date: "2026-05-29", dama: 8200, ludo: 5100 },
  { date: "2026-05-30", dama: 7400, ludo: 6300 },
  { date: "2026-05-31", dama: 10800, ludo: 7900 },
  { date: "2026-06-01", dama: 12100, ludo: 9400 },
  { date: "2026-06-02", dama: 9200, ludo: 7200 },
  { date: "2026-06-03", dama: 14600, ludo: 10100 },
  { date: "2026-06-04", dama: 13200, ludo: 8600 },
];

const MOCK_GAME_BREAKDOWN = {
  dama: 58,
  ludo: 42,
  damaMatches: 412,
  ludoMatches: 298,
  damaBetVolume: 88320.50,
  ludoBetVolume: 64080.00,
};

const MOCK_MATCHES = [
  { id: 1, game: "dama" as const, player1Name: "Carlos Silva", player2Name: "Ana Costa", betAmount: 25.00, status: "live" as const, winnerName: null, winnerId: null, createdAt: "2026-06-04T08:30:00Z", durationSeconds: null },
  { id: 2, game: "ludo" as const, player1Name: "Pedro Santos", player2Name: "Maria Oliveira", betAmount: 50.00, status: "live" as const, winnerName: null, winnerId: null, createdAt: "2026-06-04T08:45:00Z", durationSeconds: null },
  { id: 3, game: "dama" as const, player1Name: "João Ferreira", player2Name: "Sofia Martins", betAmount: 100.00, status: "finished" as const, winnerName: "João Ferreira", winnerId: 3, createdAt: "2026-06-03T14:20:00Z", durationSeconds: 1240 },
  { id: 4, game: "ludo" as const, player1Name: "Ricardo Lima", player2Name: "Beatriz Sousa", betAmount: 75.00, status: "finished" as const, winnerName: "Beatriz Sousa", winnerId: 8, createdAt: "2026-06-03T11:10:00Z", durationSeconds: 980 },
  { id: 5, game: "dama" as const, player1Name: "Miguel Araújo", player2Name: "Inês Rodrigues", betAmount: 30.00, status: "pending" as const, winnerName: null, winnerId: null, createdAt: "2026-06-04T09:00:00Z", durationSeconds: null },
  { id: 6, game: "ludo" as const, player1Name: "Tomás Carvalho", player2Name: "Laura Pereira", betAmount: 200.00, status: "live" as const, winnerName: null, winnerId: null, createdAt: "2026-06-04T09:15:00Z", durationSeconds: null },
  { id: 7, game: "dama" as const, player1Name: "André Lopes", player2Name: "Catarina Nunes", betAmount: 45.00, status: "finished" as const, winnerName: "Catarina Nunes", winnerId: 14, createdAt: "2026-06-02T16:30:00Z", durationSeconds: 720 },
  { id: 8, game: "ludo" as const, player1Name: "Filipe Gomes", player2Name: "Mariana Mendes", betAmount: 60.00, status: "finished" as const, winnerName: "Filipe Gomes", winnerId: 15, createdAt: "2026-06-02T13:45:00Z", durationSeconds: 1560 },
];

const MOCK_PLAYERS = [
  { id: 1, username: "carlos_silva", status: "online" as const, balance: 345.50, wins: 28, losses: 12, totalBets: 1240.00, createdAt: "2025-11-15T00:00:00Z" },
  { id: 2, username: "ana_costa",    status: "in_game" as const, balance: 120.00, wins: 15, losses: 9,  totalBets: 720.00,  createdAt: "2025-12-01T00:00:00Z" },
  { id: 3, username: "joao_ferreira",status: "offline" as const, balance: 880.25, wins: 52, losses: 18, totalBets: 3500.00, createdAt: "2025-10-08T00:00:00Z" },
  { id: 4, username: "maria_oliveira",status:"online" as const, balance: 65.00,  wins: 7,  losses: 14, totalBets: 420.00,  createdAt: "2026-01-22T00:00:00Z" },
  { id: 5, username: "pedro_santos", status: "suspended" as const, balance: 0,   wins: 3,  losses: 8,  totalBets: 220.00,  createdAt: "2026-02-10T00:00:00Z" },
  { id: 6, username: "sofia_martins",status: "offline" as const, balance: 430.00, wins: 33, losses: 21, totalBets: 2800.00, createdAt: "2025-09-30T00:00:00Z" },
  { id: 7, username: "ricardo_lima", status: "online" as const,  balance: 210.75, wins: 19, losses: 11, totalBets: 960.00,  createdAt: "2026-01-05T00:00:00Z" },
  { id: 8, username: "beatriz_sousa",status: "in_game" as const, balance: 575.00, wins: 41, losses: 15, totalBets: 2100.00, createdAt: "2025-11-28T00:00:00Z" },
];

const MOCK_BETS = [
  { id: 1, playerName: "carlos_silva",  game: "dama" as const, matchId: 1,  amount: 25.00, payout: null,   status: "active" as const,    createdAt: "2026-06-04T08:30:00Z" },
  { id: 2, playerName: "ana_costa",     game: "ludo" as const, matchId: 2,  amount: 50.00, payout: null,   status: "active" as const,    createdAt: "2026-06-04T08:45:00Z" },
  { id: 3, playerName: "joao_ferreira", game: "dama" as const, matchId: 3,  amount: 100.00,payout: 190.00, status: "settled" as const,   createdAt: "2026-06-03T14:20:00Z" },
  { id: 4, playerName: "beatriz_sousa", game: "ludo" as const, matchId: 4,  amount: 75.00, payout: 142.50, status: "settled" as const,   createdAt: "2026-06-03T11:10:00Z" },
  { id: 5, playerName: "pedro_santos",  game: "dama" as const, matchId: 5,  amount: 30.00, payout: null,   status: "cancelled" as const, createdAt: "2026-06-04T09:00:00Z" },
  { id: 6, playerName: "sofia_martins", game: "ludo" as const, matchId: 6,  amount: 200.00,payout: null,   status: "active" as const,    createdAt: "2026-06-04T09:15:00Z" },
  { id: 7, playerName: "catarina_nunes",game: "dama" as const, matchId: 7,  amount: 45.00, payout: 85.50,  status: "settled" as const,   createdAt: "2026-06-02T16:30:00Z" },
  { id: 8, playerName: "filipe_gomes",  game: "ludo" as const, matchId: 8,  amount: 60.00, payout: 114.00, status: "settled" as const,   createdAt: "2026-06-02T13:45:00Z" },
];

const MOCK_RANKING = [
  { playerId: 3,  rank: 1, username: "joao_ferreira", wins: 52, losses: 18, winRate: 74.3, totalEarnings: 4820.50 },
  { playerId: 8,  rank: 2, username: "beatriz_sousa", wins: 41, losses: 15, winRate: 73.2, totalEarnings: 3960.75 },
  { playerId: 6,  rank: 3, username: "sofia_martins", wins: 33, losses: 21, winRate: 61.1, totalEarnings: 2750.00 },
  { playerId: 1,  rank: 4, username: "carlos_silva",  wins: 28, losses: 12, winRate: 70.0, totalEarnings: 1980.25 },
  { playerId: 7,  rank: 5, username: "ricardo_lima",  wins: 19, losses: 11, winRate: 63.3, totalEarnings: 1240.00 },
  { playerId: 2,  rank: 6, username: "ana_costa",     wins: 15, losses: 9,  winRate: 62.5, totalEarnings: 870.50  },
  { playerId: 4,  rank: 7, username: "maria_oliveira",wins: 7,  losses: 14, winRate: 33.3, totalEarnings: 210.00  },
  { playerId: 5,  rank: 8, username: "pedro_santos",  wins: 3,  losses: 8,  winRate: 27.3, totalEarnings: 80.00   },
];

const MOCK_REPORTS = [
  { id: 1, reporterName: "carlos_silva",  accusedName: "pedro_santos",   reason: "Abandono de partida",   description: "O jogador saiu da partida sem clicar em desistir.", matchId: 4, status: "pending" as const,   createdAt: "2026-06-04T07:15:00Z" },
  { id: 2, reporterName: "ana_costa",     accusedName: "maria_oliveira",  reason: "Comportamento inapropriado", description: "Insultos no chat durante a partida.",            matchId: 2, status: "pending" as const,   createdAt: "2026-06-03T22:40:00Z" },
  { id: 3, reporterName: "joao_ferreira", accusedName: "filipe_gomes",    reason: "Suspeita de trapaça",   description: "Movimentos impossíveis de executar legitimamente.", matchId: 8, status: "reviewed" as const,  createdAt: "2026-06-02T18:00:00Z" },
  { id: 4, reporterName: "sofia_martins", accusedName: "miguel_araujo",   reason: "Conta múltipla",        description: "Suspeito de usar várias contas no mesmo IP.",       matchId: 5, status: "dismissed" as const, createdAt: "2026-06-01T10:30:00Z" },
];

const MOCK_WITHDRAWALS = [
  { id: 1, playerName: "joao_ferreira",  amount: 500.00, method: "PIX",           status: "pending" as const,   createdAt: "2026-06-04T06:00:00Z" },
  { id: 2, playerName: "beatriz_sousa",  amount: 200.00, method: "Transferência", status: "pending" as const,   createdAt: "2026-06-04T07:30:00Z" },
  { id: 3, playerName: "carlos_silva",   amount: 150.00, method: "PIX",           status: "approved" as const,  createdAt: "2026-06-03T14:00:00Z" },
  { id: 4, playerName: "sofia_martins",  amount: 300.00, method: "PIX",           status: "approved" as const,  createdAt: "2026-06-02T11:00:00Z" },
  { id: 5, playerName: "pedro_santos",   amount: 80.00,  method: "Transferência", status: "rejected" as const,  createdAt: "2026-06-01T09:00:00Z" },
  { id: 6, playerName: "ricardo_lima",   amount: 120.00, method: "PIX",           status: "pending" as const,   createdAt: "2026-06-04T08:00:00Z" },
];

const MOCK_ANTIFRAUD = {
  flaggedAccounts: 3,
  suspiciousBets: 7,
  unusualPatterns: 4,
  resolvedToday: 2,
  alerts: [
    { id: 1, playerName: "pedro_santos",   type: "multiple_accounts", severity: "high" as const,   description: "Detectadas 3 contas com o mesmo IP (192.168.1.45). Registo em menos de 24h.", createdAt: "2026-06-04T08:10:00Z" },
    { id: 2, playerName: "usuario_xyz91",  type: "rapid_betting",     severity: "medium" as const,  description: "57 apostas em menos de 2 horas. Padrão atípico para perfil de jogador.", createdAt: "2026-06-04T07:45:00Z" },
    { id: 3, playerName: "miguel_araujo",  type: "win_rate_anomaly",  severity: "medium" as const,  description: "Taxa de vitória de 94% nas últimas 20 partidas. Estatisticamente improvável.", createdAt: "2026-06-03T23:30:00Z" },
    { id: 4, playerName: "jogador_teste2", type: "account_sharing",   severity: "low" as const,    description: "Login a partir de 4 dispositivos diferentes em menos de 6 horas.", createdAt: "2026-06-03T20:00:00Z" },
  ],
};

/* ──────────────────────────────────────────
   MOCK HOOKS — drop-in replacements for
   @workspace/api-client-react
────────────────────────────────────────── */

function mockQuery<T>(key: unknown[], data: T, delay = 300) {
  return useQuery<T>({
    queryKey: key,
    queryFn: () => new Promise<T>(resolve => setTimeout(() => resolve(data), delay)),
    staleTime: Infinity,
  });
}

function mockMutation<TData = unknown, TVariables = unknown>(
  fn: (vars: TVariables) => Promise<TData>
) {
  return useMutation<TData, Error, TVariables>({ mutationFn: fn });
}

/* Dashboard */
export function useGetDashboardStats() {
  return mockQuery(["dashboard-stats"], MOCK_STATS);
}
export function useGetMatchesOverTime() {
  return mockQuery(["matches-over-time"], MOCK_MATCHES_OVER_TIME);
}
export function useGetBetsOverTime() {
  return mockQuery(["bets-over-time"], MOCK_BETS_OVER_TIME);
}
export function useGetGameBreakdown() {
  return mockQuery(["game-breakdown"], MOCK_GAME_BREAKDOWN);
}

/* Matches */
export function useListMatches(params?: { status?: "live" | "finished" | "pending"; game?: "dama" | "ludo" }) {
  const filtered = MOCK_MATCHES.filter(m => {
    if (params?.status && m.status !== params.status) return false;
    if (params?.game   && m.game   !== params.game)   return false;
    return true;
  });
  return mockQuery(["matches", params], filtered);
}
export function useGetMatch(id: number, _opts?: unknown) {
  const match = MOCK_MATCHES.find(m => m.id === id) ?? null;
  return mockQuery(["match", id], match);
}
export function getGetMatchQueryKey(id: number) { return ["match", id]; }
export function useResolveMatch() {
  const qc = useQueryClient();
  return mockMutation<unknown, { id: number; data: { winnerId: number } }>(async ({ id }) => {
    await new Promise(r => setTimeout(r, 600));
    qc.invalidateQueries({ queryKey: ["match", id] });
    qc.invalidateQueries({ queryKey: ["matches"] });
    return { ok: true };
  });
}

/* Players */
export function useListPlayers() {
  return mockQuery(["players"], MOCK_PLAYERS);
}
export function getListPlayersQueryKey() { return ["players"]; }
export function useGetPlayer(id: number, _opts?: unknown) {
  const player = MOCK_PLAYERS.find(p => p.id === id) ?? null;
  return mockQuery(["player", id], player);
}
export function getGetPlayerQueryKey(id: number) { return ["player", id]; }
export function useSuspendPlayer() {
  const qc = useQueryClient();
  return mockMutation<unknown, { id: number; data: { reason: string } }>(async ({ id }) => {
    await new Promise(r => setTimeout(r, 600));
    qc.invalidateQueries({ queryKey: ["players"] });
    qc.invalidateQueries({ queryKey: ["player", id] });
    return { ok: true };
  });
}

/* Bets */
export function useListBets(params?: { status?: "active" | "settled" | "cancelled" }) {
  const filtered = params?.status ? MOCK_BETS.filter(b => b.status === params.status) : MOCK_BETS;
  return mockQuery(["bets", params], filtered);
}
export function getListBetsQueryKey() { return ["bets"]; }
export function useCancelBet() {
  const qc = useQueryClient();
  return mockMutation<unknown, { id: number }>(async () => {
    await new Promise(r => setTimeout(r, 500));
    qc.invalidateQueries({ queryKey: ["bets"] });
    return { ok: true };
  });
}

/* Ranking */
export function useGetRanking(params?: { game?: "dama" | "ludo" | "all" }) {
  return mockQuery(["ranking", params], MOCK_RANKING);
}

/* Reports */
export function useListReports(params?: { status?: "pending" | "reviewed" | "dismissed" }) {
  const filtered = params?.status ? MOCK_REPORTS.filter(r => r.status === params.status) : MOCK_REPORTS;
  return mockQuery(["reports", params], filtered);
}
export function getListReportsQueryKey() { return ["reports"]; }
export function useResolveReport() {
  const qc = useQueryClient();
  return mockMutation<unknown, { id: number; data: { action: string; notes: string } }>(async () => {
    await new Promise(r => setTimeout(r, 600));
    qc.invalidateQueries({ queryKey: ["reports"] });
    return { ok: true };
  });
}

/* Withdrawals */
export function useListWithdrawals(params?: { status?: "pending" | "approved" | "rejected" }) {
  const filtered = params?.status ? MOCK_WITHDRAWALS.filter(w => w.status === params.status) : MOCK_WITHDRAWALS;
  return mockQuery(["withdrawals", params], filtered);
}
export function getListWithdrawalsQueryKey() { return ["withdrawals"]; }
export function useApproveWithdrawal() {
  const qc = useQueryClient();
  return mockMutation<unknown, { id: number }>(async () => {
    await new Promise(r => setTimeout(r, 500));
    qc.invalidateQueries({ queryKey: ["withdrawals"] });
    return { ok: true };
  });
}
export function useRejectWithdrawal() {
  const qc = useQueryClient();
  return mockMutation<unknown, { id: number; data: { reason: string } }>(async () => {
    await new Promise(r => setTimeout(r, 500));
    qc.invalidateQueries({ queryKey: ["withdrawals"] });
    return { ok: true };
  });
}

/* Anti-Fraud */
export function useGetAntiFraudAlerts() {
  return mockQuery(["antifraud"], MOCK_ANTIFRAUD);
}
