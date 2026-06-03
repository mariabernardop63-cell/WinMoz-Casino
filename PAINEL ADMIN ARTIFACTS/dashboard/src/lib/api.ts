const BASE = "/api";

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? res.statusText);
  }
  return res.json();
}

export const api = {
  get: <T>(path: string) => apiFetch<T>(path),
  post: <T>(path: string, body: unknown) =>
    apiFetch<T>(path, { method: "POST", body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    apiFetch<T>(path, { method: "PUT", body: JSON.stringify(body) }),
};

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
