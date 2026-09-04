import { supabase, getSessionWithRefresh, forceSessionLogout } from "@/lib/supabase";

async function getToken(): Promise<string | null> {
  try {
    const session = await getSessionWithRefresh();
    return session?.access_token ?? null;
  } catch { return null; }
}

/* 401 numa chamada de jogo → preserva a sessão local e deixa o ecrã
   apresentar o erro/repetir, sem logout silencioso */
function handleAuthError(data: { error?: string } | null) {
  const msg = String(data?.error ?? "");
  if (/não autenticado|sessão inválida|unauthorized/i.test(msg)) {
    forceSessionLogout();
  }
}

export interface BetResult {
  ok: boolean;
  newBalance: number;
  error?: string;
}

export interface WinResult {
  ok: boolean;
  payout: number;
  newBalance: number;
  error?: string;
}

export interface DiceResult {
  value: number;
  error?: string;
}

export async function serverBet(
  amount: number,
  gameType: "damas" | "ludo" | "xadrez",
  description?: string,
  gameId?: string
): Promise<BetResult> {
  const token = await getToken();
  if (!token) return { ok: false, newBalance: 0, error: "Não autenticado" };

  const res = await fetch("/api/games/bet", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ amount, gameType, description, gameId }),
  });
  const data = await res.json() as { ok?: boolean; newBalance?: number; error?: string };
  if (!res.ok || !data.ok) {
    if (res.status === 401) handleAuthError(data);
    return { ok: false, newBalance: 0, error: data.error ?? "Erro ao processar aposta" };
  }
  return { ok: true, newBalance: data.newBalance ?? 0 };
}

export async function serverWin(
  gameId: string,
  gameType: "damas" | "ludo" | "xadrez",
  betAmount: number
): Promise<WinResult> {
  const token = await getToken();
  if (!token) return { ok: false, payout: 0, newBalance: 0, error: "Não autenticado" };

  const res = await fetch("/api/games/win", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ gameId, gameType, betAmount }),
  });
  const data = await res.json() as { ok?: boolean; payout?: number; newBalance?: number; error?: string };
  if (!res.ok || !data.ok) {
    if (res.status === 401) handleAuthError(data);
    return { ok: false, payout: 0, newBalance: 0, error: data.error ?? "Erro ao registar vitória" };
  }
  return { ok: true, payout: data.payout ?? 0, newBalance: data.newBalance ?? 0 };
}

export async function rollLudoDice(
  gameId: string,
  allInBase: boolean,
  stuckTurns: number,
  consecutiveSixes: number
): Promise<DiceResult> {
  const token = await getToken();
  if (!token) {
    const val = Math.floor(Math.random() * 6) + 1;
    return { value: val };
  }

  try {
    const res = await fetch("/api/games/ludo-dice", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ gameId, allInBase, stuckTurns, consecutiveSixes }),
    });
    const data = await res.json() as { value?: number; error?: string };
    if (!res.ok || !data.value) {
      const fallback = Math.floor(Math.random() * 6) + 1;
      return { value: fallback };
    }
    return { value: data.value };
  } catch {
    const fallback = Math.floor(Math.random() * 6) + 1;
    return { value: fallback };
  }
}
