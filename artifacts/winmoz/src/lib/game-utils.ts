import { supabase } from "./supabase";

export const PLATFORM_CUT = 0.10;

export interface GameResult {
  winnerId: string;
  loserId: string;
  winnerName: string;
  gameType: string;
  betAmount: number;
  matchId?: string;
}

export async function applyGameWin(result: GameResult): Promise<{ winnerPayout: number; platformFee: number }> {
  const pot = result.betAmount * 2;
  const platformFee = pot * PLATFORM_CUT;
  const winnerPayout = pot * (1 - PLATFORM_CUT);

  try {
    const { data: winnerProfile } = await supabase
      .from("profiles")
      .select("balance, total_wins, total_games")
      .eq("id", result.winnerId)
      .single();

    const { data: loserProfile } = await supabase
      .from("profiles")
      .select("total_games")
      .eq("id", result.loserId)
      .single();

    await Promise.all([
      winnerProfile && supabase.from("profiles").update({
        balance: Number(winnerProfile.balance) + winnerPayout,
        total_wins: (winnerProfile.total_wins ?? 0) + 1,
        total_games: (winnerProfile.total_games ?? 0) + 1,
      }).eq("id", result.winnerId),

      loserProfile !== null && supabase.from("profiles").update({
        total_games: ((loserProfile as any)?.total_games ?? 0) + 1,
      }).eq("id", result.loserId),

      supabase.from("platform_earnings").insert({
        type: "bet_fee",
        amount: platformFee,
        reference_id: result.matchId ?? null,
        user_id: result.winnerId,
      }),

      supabase.from("transactions").insert({
        user_id: result.winnerId,
        type: "win",
        amount: winnerPayout,
        description: `Vitória em ${capitalize(result.gameType)} — ganhou MT ${winnerPayout.toFixed(2)} (90% de MT ${pot.toFixed(2)})`,
        status: "approved",
      }),

      result.matchId && supabase.from("matches").update({
        status: "completed",
        winner_id: result.winnerId,
        winner_name: result.winnerName,
        platform_fee: platformFee,
        winner_payout: winnerPayout,
        completed_at: new Date().toISOString(),
      }).eq("id", result.matchId),
    ]);
  } catch (e) {
    console.error("applyGameWin error:", e);
  }

  return { winnerPayout, platformFee };
}

export async function recordMatchStart(opts: {
  gameType: string;
  player1Id: string;
  player2Id: string;
  player1Name: string;
  player2Name: string;
  betAmount: number;
  gameChannel?: string;
}): Promise<string | null> {
  try {
    const { data, error } = await supabase.from("matches").insert({
      game_type: opts.gameType,
      status: "active",
      player1_id: opts.player1Id,
      player2_id: opts.player2Id,
      player1_name: opts.player1Name,
      player2_name: opts.player2Name,
      bet_amount: opts.betAmount,
      game_channel: opts.gameChannel,
    }).select("id").single();

    if (error) return null;
    return data.id;
  } catch {
    return null;
  }
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export async function recordOnlinePresence(userId: string) {
  try {
    await supabase.from("profiles").update({ last_seen_at: new Date().toISOString() }).eq("id", userId);
  } catch { }
}
