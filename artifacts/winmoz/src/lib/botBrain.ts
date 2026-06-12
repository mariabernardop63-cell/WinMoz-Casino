// ─── Bot Brain — Adaptive Intelligence Engine ────────────────────────────────
// Opaque difficulty system. No detectable patterns exposed to players.

import { supabase } from "@/lib/supabase";

// ── Internal storage keys (obfuscated) ──────────────────────────────────────
const _dk  = (id: string) => `_wm_x1_${id.slice(-6)}`;
const _ek  = (id: string) => `_wm_x2_${id.slice(-6)}`;
const _gk  = "_wm_x3";
const _TTL = 4 * 60 * 1000; // 4 min cache

interface _GS { bw: number; uw: number; ts: number }
interface _US { streak: number; total: number }

async function _fetchGlobal(): Promise<_GS | null> {
  try {
    const raw = sessionStorage.getItem(_gk);
    if (raw) {
      const g = JSON.parse(raw) as _GS;
      if (Date.now() - g.ts < _TTL) return g;
    }
    const { data } = await supabase
      .from("matches")
      .select("winner_id, player1_id")
      .is("player2_id", null)
      .eq("status", "finished");
    if (!data) return null;
    const bw = data.filter(m => !m.winner_id || m.winner_id !== m.player1_id).length;
    const uw = data.filter(m => m.winner_id && m.winner_id === m.player1_id).length;
    const g: _GS = { bw, uw, ts: Date.now() };
    sessionStorage.setItem(_gk, JSON.stringify(g));
    return g;
  } catch { return null; }
}

async function _fetchUser(uid: string): Promise<_US | null> {
  try {
    const { data } = await supabase
      .from("matches")
      .select("winner_id, player1_id, created_at")
      .eq("player1_id", uid)
      .is("player2_id", null)
      .eq("status", "finished")
      .order("created_at", { ascending: false })
      .limit(12);
    if (!data) return null;
    let streak = 0;
    for (const m of data) {
      if (m.winner_id !== m.player1_id) streak++;
      else break;
    }
    return { streak, total: data.length };
  } catch { return null; }
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Call before each bot game. Evaluates global + per-user stats, assigns difficulty. */
export async function evaluateBotDifficulty(uid: string): Promise<"hard" | "easy"> {
  try {
    const [g, u] = await Promise.all([_fetchGlobal(), _fetchUser(uid)]);

    // Auto-disable check: bot wins exceed user wins by more than 3
    if (g && g.bw - g.uw > 3) {
      localStorage.setItem("wm_bots_disabled", "true");
      localStorage.setItem("wm_bots_autodisabled", "true");
      sessionStorage.setItem(_dk(uid), "hard");
      return "hard";
    }

    // Never repeat easy mode
    const easyFlag = parseInt(sessionStorage.getItem(_ek(uid)) ?? "0");
    if (easyFlag >= 1) {
      sessionStorage.removeItem(_ek(uid));
      sessionStorage.setItem(_dk(uid), "hard");
      return "hard";
    }

    // Rule 1: user lost 2+ consecutive → 35% chance to ease 3rd game
    if (u && u.streak >= 2) {
      const r1 = Math.random();
      const r2 = Math.random(); // second random for entropy mixing
      if ((r1 * r2 * 4) < 0.35) {
        sessionStorage.setItem(_dk(uid), "easy");
        sessionStorage.setItem(_ek(uid), "1");
        return "easy";
      }
    }

    // Rule 2: bot global win rate > 68% AND enough games → 20% chance to ease
    if (g && g.bw + g.uw > 15) {
      const rate = g.bw / (g.bw + g.uw);
      if (rate > 0.68) {
        const r = Math.random() + Math.random() * 0.1;
        if (r < 0.20) {
          sessionStorage.setItem(_dk(uid), "easy");
          sessionStorage.setItem(_ek(uid), "1");
          return "easy";
        }
      }
    }

    sessionStorage.setItem(_dk(uid), "hard");
    return "hard";
  } catch {
    sessionStorage.setItem(_dk(uid), "hard");
    return "hard";
  }
}

/** Synchronous read of already-evaluated difficulty. */
export function getBotDifficultySync(uid: string): "hard" | "easy" {
  return (sessionStorage.getItem(_dk(uid)) as "hard" | "easy") ?? "hard";
}

/** Called from admin panel / startup. Returns true if auto-disabled. */
export async function checkAutoDisable(): Promise<boolean> {
  const g = await _fetchGlobal();
  if (!g) return false;
  if (g.bw - g.uw > 3) {
    localStorage.setItem("wm_bots_disabled", "true");
    localStorage.setItem("wm_bots_autodisabled", "true");
    return true;
  }
  return false;
}

/** Admin re-enables bots (clears all auto-disable flags). */
export function adminReEnable(): void {
  localStorage.setItem("wm_bots_disabled", "false");
  localStorage.removeItem("wm_bots_autodisabled");
  sessionStorage.removeItem(_gk); // force stats refresh
}

/** Read global stats (cached) for display. */
export async function getGlobalBotStats(): Promise<{ botWins: number; userWins: number; autoDisabled: boolean } | null> {
  const g = await _fetchGlobal();
  if (!g) return null;
  return {
    botWins: g.bw,
    userWins: g.uw,
    autoDisabled: localStorage.getItem("wm_bots_autodisabled") === "true",
  };
}
