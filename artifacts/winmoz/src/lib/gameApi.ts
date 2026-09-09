import { ensureFreshSession, recoverAfter401, forceSessionLogout } from "@/lib/supabase";

async function getToken(): Promise<string | null> {
  try {
    const session = await ensureFreshSession({ marginSeconds: 60 });
    return session?.access_token ?? null;
  } catch { return null; }
}

/* Pedido autenticado com retry: num 401, refresca o token e repete UMA vez
   antes de declarar a sessão terminada. Só encerra a sessão quando nem o
   refresh consegue produzir um token novo — uma falha de rede nunca
   desloga o utilizador. */
async function postWithAuthRetry(
  url: string,
  body: unknown,
  signal?: AbortSignal
): Promise<{ res: Response; data: Record<string, unknown> } | null> {
  let token = await getToken();
  if (!token) return null;

  const doFetch = (t: string) => fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${t}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal,
  });

  let res = await doFetch(token);
  if (res.status === 401) {
    const recovered = await recoverAfter401();
    if (recovered) {
      const fresh = await getToken();
      if (fresh) res = await doFetch(fresh);
    }
    if (res.status === 401) forceSessionLogout("api_unauthorized");
  }
  let data: Record<string, unknown> = {};
  try { data = await res.json() as Record<string, unknown>; } catch { /* body vazio */ }
  return { res, data };
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
  turnBlocked?: boolean;
  serverTurn?: "blue" | "green";
}

export interface PassTurnResult {
  ok: boolean;
  turn?: "blue" | "green";
  error?: string;
  serverTurn?: "blue" | "green";
}

export async function serverBet(
  amount: number,
  gameType: "damas" | "ludo" | "xadrez",
  description?: string,
  gameId?: string
): Promise<BetResult> {
  const result = await postWithAuthRetry("/api/games/bet", { amount, gameType, description, gameId });
  if (!result) return { ok: false, newBalance: 0, error: "Não autenticado" };
  const { res, data } = result;
  if (!res.ok || !data.ok) {
    return { ok: false, newBalance: 0, error: (data.error as string) ?? "Erro ao processar aposta" };
  }
  return { ok: true, newBalance: Number(data.newBalance ?? 0) };
}

export async function serverWin(
  gameId: string,
  gameType: "damas" | "ludo" | "xadrez",
  betAmount: number
): Promise<WinResult> {
  const result = await postWithAuthRetry("/api/games/win", { gameId, gameType, betAmount });
  if (!result) return { ok: false, payout: 0, newBalance: 0, error: "Não autenticado" };
  const { res, data } = result;
  if (!res.ok || !data.ok) {
    return { ok: false, payout: 0, newBalance: 0, error: (data.error as string) ?? "Erro ao registar vitória" };
  }
  return { ok: true, payout: Number(data.payout ?? 0), newBalance: Number(data.newBalance ?? 0) };
}

export async function rollLudoDice(
  gameId: string,
  allInBase: boolean,
  stuckTurns: number,
  consecutiveSixes: number
): Promise<DiceResult> {
  const token = await getToken();
  if (!token) {
    return { value: 0, error: "Não autenticado" };
  }

  try {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8_000);
    try {
      const result = await postWithAuthRetry("/api/games/ludo-dice", { gameId, allInBase, stuckTurns, consecutiveSixes }, controller.signal);
      if (!result) return { value: 0, error: "Não autenticado" };
      const { res, data } = result;
      if (!res.ok || typeof data.value !== "number" || !Number.isInteger(data.value) || data.value < 1 || data.value > 6) {
        // 423 = server says it's not this player's turn — a hard signal the
        // local turn state diverged and a resync is required.
        if (res.status === 423) {
          const st = data.turn as string | undefined;
          return { value: 0, error: (data.error as string) ?? "Não é a tua vez", turnBlocked: true, serverTurn: st === "blue" || st === "green" ? st : undefined };
        }
        return { value: 0, error: (data.error as string) ?? "Erro ao rolar o dado" };
      }
      return { value: data.value as number };
    } finally {
      window.clearTimeout(timeout);
    }
  } catch (error) {
    return {
      value: 0,
      error: error instanceof DOMException && error.name === "AbortError"
        ? "O servidor demorou demasiado a responder"
        : "Erro de ligação ao servidor",
    };
  }
}

export async function passLudoTurn(
  gameId: string,
  keepTurn: boolean,
  reopen = false,
  force = false
): Promise<PassTurnResult> {
  const token = await getToken();
  if (!token) return { ok: false, error: "Não autenticado" };
  try {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8_000);
    try {
      const result = await postWithAuthRetry("/api/games/ludo-turn", { gameId, keepTurn, reopen, force }, controller.signal);
      if (!result) return { ok: false, error: "Não autenticado" };
      const { res, data } = result;
      if (!res.ok || !data.ok) {
        const st = data.turn as string | undefined;
        return { ok: false, error: (data.error as string) ?? "Erro ao passar a vez", serverTurn: st === "blue" || st === "green" ? st : undefined };
      }
      return { ok: true, turn: data.turn as "blue" | "green" | undefined };
    } finally {
      window.clearTimeout(timeout);
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof DOMException && error.name === "AbortError"
        ? "O servidor demorou demasiado a responder"
        : "Erro de ligação ao servidor",
    };
  }
}
