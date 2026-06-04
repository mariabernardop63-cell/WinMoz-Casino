export interface AdminProfile {
  id: number;
  name: string;
  username: string;
  email: string;
  phone: string | null;
  role: string;
  avatarUrl: string | null;
  createdAt: string;
}

export interface Notification {
  type: string;
  label: string;
  createdAt: string;
}

export interface NotificationsData {
  total: number;
  pendingWithdrawals: number;
  newDeposits: number;
  newPlayers: number;
  pendingReports: number;
  items: Notification[];
}

export interface OnlinePlayer {
  id: number;
  username: string;
  avatarUrl: string | null;
  status: string;
  balance: number;
  updatedAt: string;
}

export interface BalanceAdjustment {
  id: number;
  playerId: number;
  playerName: string;
  adminId: number | null;
  amount: number;
  reason: string;
  note: string | null;
  balanceBefore: number;
  balanceAfter: number;
  createdAt: string;
}

export interface ActivityLog {
  id: number;
  action: string;
  detail: string | null;
  ip: string | null;
  adminId: number | null;
  adminUsername: string | null;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  total: number;
  page: number;
  limit: number;
  data: T[];
}

/* ── Mock data for pages that use api directly ── */

const MOCK_ONLINE_PLAYERS: OnlinePlayer[] = [
  { id: 1, username: "carlos_silva",   avatarUrl: null, status: "online",    balance: 345.50, updatedAt: new Date(Date.now() - 120000).toISOString() },
  { id: 2, username: "ana_costa",      avatarUrl: null, status: "in_game",   balance: 120.00, updatedAt: new Date(Date.now() - 60000).toISOString()  },
  { id: 3, username: "joao_ferreira",  avatarUrl: null, status: "offline",   balance: 880.25, updatedAt: new Date(Date.now() - 900000).toISOString() },
  { id: 4, username: "maria_oliveira", avatarUrl: null, status: "online",    balance: 65.00,  updatedAt: new Date(Date.now() - 30000).toISOString()  },
  { id: 5, username: "pedro_santos",   avatarUrl: null, status: "suspended", balance: 0,      updatedAt: new Date(Date.now() - 3600000).toISOString()},
  { id: 6, username: "sofia_martins",  avatarUrl: null, status: "offline",   balance: 430.00, updatedAt: new Date(Date.now() - 1800000).toISOString()},
  { id: 7, username: "ricardo_lima",   avatarUrl: null, status: "online",    balance: 210.75, updatedAt: new Date(Date.now() - 45000).toISOString()  },
  { id: 8, username: "beatriz_sousa",  avatarUrl: null, status: "in_game",   balance: 575.00, updatedAt: new Date(Date.now() - 90000).toISOString()  },
];

const MOCK_BALANCE_ADJUSTMENTS: BalanceAdjustment[] = [
  { id: 1, playerId: 1, playerName: "carlos_silva",   adminId: 1, amount: 50.00,   reason: "bonus_win",        note: null,              balanceBefore: 295.50, balanceAfter: 345.50, createdAt: new Date(Date.now() - 7200000).toISOString()  },
  { id: 2, playerId: 4, playerName: "maria_oliveira", adminId: 1, amount: -20.00,  reason: "penalty",          note: "Violação leve",   balanceBefore: 85.00,  balanceAfter: 65.00,  createdAt: new Date(Date.now() - 14400000).toISOString() },
  { id: 3, playerId: 3, playerName: "joao_ferreira",  adminId: 1, amount: 100.00,  reason: "bonus_signup",     note: null,              balanceBefore: 780.25, balanceAfter: 880.25, createdAt: new Date(Date.now() - 28800000).toISOString() },
  { id: 4, playerId: 7, playerName: "ricardo_lima",   adminId: 1, amount: 10.75,   reason: "fee_refund",       note: "Reembolso taxa",  balanceBefore: 200.00, balanceAfter: 210.75, createdAt: new Date(Date.now() - 43200000).toISOString() },
  { id: 5, playerId: 8, playerName: "beatriz_sousa",  adminId: 1, amount: 75.00,   reason: "promotion",        note: "Promo junho",     balanceBefore: 500.00, balanceAfter: 575.00, createdAt: new Date(Date.now() - 57600000).toISOString() },
];

const MOCK_ACTIVITY_LOGS: ActivityLog[] = [
  { id: 1,  action: "login",               detail: "Login bem-sucedido",                       ip: "192.168.1.1",   adminId: 1, adminUsername: "admin",     createdAt: new Date(Date.now() - 300000).toISOString()   },
  { id: 2,  action: "withdrawal_approve",  detail: "Saque #3 aprovado — carlos_silva R$150",   ip: "192.168.1.1",   adminId: 1, adminUsername: "admin",     createdAt: new Date(Date.now() - 3600000).toISOString()  },
  { id: 3,  action: "player_suspend",      detail: "Jogador pedro_santos suspenso",             ip: "192.168.1.1",   adminId: 1, adminUsername: "admin",     createdAt: new Date(Date.now() - 7200000).toISOString()  },
  { id: 4,  action: "balance_adjustment",  detail: "Ajuste R$50 em carlos_silva — bonus_win",  ip: "192.168.1.1",   adminId: 1, adminUsername: "admin",     createdAt: new Date(Date.now() - 10800000).toISOString() },
  { id: 5,  action: "report_resolve",      detail: "Denúncia #3 marcada como revisada",        ip: "192.168.1.1",   adminId: 1, adminUsername: "admin",     createdAt: new Date(Date.now() - 18000000).toISOString() },
  { id: 6,  action: "match_resolve",       detail: "Partida #3 — Vencedor: joao_ferreira",     ip: "192.168.1.1",   adminId: 1, adminUsername: "admin",     createdAt: new Date(Date.now() - 21600000).toISOString() },
  { id: 7,  action: "withdrawal_reject",   detail: "Saque #5 rejeitado — Documentação",        ip: "192.168.1.2",   adminId: 2, adminUsername: "moderador", createdAt: new Date(Date.now() - 28800000).toISOString() },
  { id: 8,  action: "bet_cancel",          detail: "Aposta #5 cancelada — pedro_santos",       ip: "192.168.1.2",   adminId: 2, adminUsername: "moderador", createdAt: new Date(Date.now() - 36000000).toISOString() },
  { id: 9,  action: "profile_update",      detail: "Perfil admin actualizado",                  ip: "192.168.1.1",   adminId: 1, adminUsername: "admin",     createdAt: new Date(Date.now() - 43200000).toISOString() },
  { id: 10, action: "login",               detail: "Login bem-sucedido",                       ip: "192.168.1.2",   adminId: 2, adminUsername: "moderador", createdAt: new Date(Date.now() - 50400000).toISOString() },
];

const MOCK_ADMIN_PROFILE: AdminProfile = {
  id: 1,
  name: "Administrador Principal",
  username: "admin",
  email: "admin@gamezone.pt",
  phone: "+351 912 345 678",
  role: "super_admin",
  avatarUrl: null,
  createdAt: "2025-01-01T00:00:00Z",
};

const MOCK_NOTIFICATIONS: NotificationsData = {
  total: 6,
  pendingWithdrawals: 3,
  newDeposits: 1,
  newPlayers: 2,
  pendingReports: 2,
  items: [
    { type: "withdrawal", label: "Novo saque pendente de joao_ferreira",  createdAt: new Date(Date.now() - 1800000).toISOString() },
    { type: "withdrawal", label: "Novo saque pendente de beatriz_sousa",  createdAt: new Date(Date.now() - 3600000).toISOString() },
    { type: "report",     label: "Nova denúncia de carlos_silva",         createdAt: new Date(Date.now() - 7200000).toISOString() },
    { type: "player",     label: "Novo jogador registado: novo_user1",    createdAt: new Date(Date.now() - 10800000).toISOString() },
    { type: "player",     label: "Novo jogador registado: novo_user2",    createdAt: new Date(Date.now() - 14400000).toISOString() },
    { type: "report",     label: "Nova denúncia de ana_costa",            createdAt: new Date(Date.now() - 18000000).toISOString() },
  ],
};

function delay<T>(data: T, ms = 300): Promise<T> {
  return new Promise(resolve => setTimeout(() => resolve(data), ms));
}

export const api = {
  get: <T>(path: string): Promise<T> => {
    if (path.startsWith("/players/online")) return delay(MOCK_ONLINE_PLAYERS as unknown as T);
    if (path.startsWith("/balance-adjustments/search")) return delay(MOCK_ONLINE_PLAYERS.slice(0, 3) as unknown as T);
    if (path.startsWith("/balance-adjustments")) {
      const resp: PaginatedResponse<BalanceAdjustment> = {
        total: MOCK_BALANCE_ADJUSTMENTS.length,
        page: 1,
        limit: 20,
        data: MOCK_BALANCE_ADJUSTMENTS,
      };
      return delay(resp as unknown as T);
    }
    if (path.startsWith("/activity-logs")) {
      const resp: PaginatedResponse<ActivityLog> = {
        total: MOCK_ACTIVITY_LOGS.length,
        page: 1,
        limit: 25,
        data: MOCK_ACTIVITY_LOGS,
      };
      return delay(resp as unknown as T);
    }
    if (path.startsWith("/admin/profile")) return delay(MOCK_ADMIN_PROFILE as unknown as T);
    if (path.startsWith("/notifications")) return delay(MOCK_NOTIFICATIONS as unknown as T);
    return delay({} as T);
  },
  post: <T>(_path: string, _body: unknown): Promise<T> => delay({} as T, 600),
  put: <T>(_path: string, _body: unknown): Promise<T> => delay({} as T, 600),
};
