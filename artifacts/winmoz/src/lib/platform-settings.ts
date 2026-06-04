import { useState, useEffect } from "react";
import { supabase } from "./supabase";

export interface PlatformSettings {
  maintenance_mode: boolean;
  game_damas_enabled: boolean;
  game_ludo_enabled: boolean;
  game_xadrez_enabled: boolean;
  game_roleta_enabled: boolean;
  deposits_enabled: boolean;
  withdrawals_enabled: boolean;
  bets_enabled: boolean;
  new_registrations_enabled: boolean;
  withdrawal_fee: number;
  platform_cut_pct: number;
  platform_name: string;
}

const DEFAULT_SETTINGS: PlatformSettings = {
  maintenance_mode: false,
  game_damas_enabled: true,
  game_ludo_enabled: true,
  game_xadrez_enabled: true,
  game_roleta_enabled: true,
  deposits_enabled: true,
  withdrawals_enabled: true,
  bets_enabled: true,
  new_registrations_enabled: true,
  withdrawal_fee: 5,
  platform_cut_pct: 10,
  platform_name: "POKER WINNER",
};

let cachedSettings: PlatformSettings | null = null;
let settingsListeners: Array<(s: PlatformSettings) => void> = [];

async function fetchSettings(): Promise<PlatformSettings> {
  try {
    const { data } = await supabase.from("platform_settings").select("key, value");
    if (!data || data.length === 0) return { ...DEFAULT_SETTINGS };

    const raw: Record<string, string> = {};
    for (const row of data) raw[row.key] = row.value;

    return {
      maintenance_mode: raw.maintenance_mode === "true",
      game_damas_enabled: raw.game_damas_enabled !== "false",
      game_ludo_enabled: raw.game_ludo_enabled !== "false",
      game_xadrez_enabled: raw.game_xadrez_enabled !== "false",
      game_roleta_enabled: raw.game_roleta_enabled !== "false",
      deposits_enabled: raw.deposits_enabled !== "false",
      withdrawals_enabled: raw.withdrawals_enabled !== "false",
      bets_enabled: raw.bets_enabled !== "false",
      new_registrations_enabled: raw.new_registrations_enabled !== "false",
      withdrawal_fee: raw.withdrawal_fee ? Number(raw.withdrawal_fee) : 5,
      platform_cut_pct: raw.platform_cut_pct ? Number(raw.platform_cut_pct) : 10,
      platform_name: raw.platform_name ?? "POKER WINNER",
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function usePlatformSettings() {
  const [settings, setSettings] = useState<PlatformSettings>(cachedSettings ?? DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(!cachedSettings);

  useEffect(() => {
    let cancelled = false;

    fetchSettings().then(s => {
      if (cancelled) return;
      cachedSettings = s;
      setSettings(s);
      setLoading(false);
    });

    const channel = supabase
      .channel("platform_settings_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "platform_settings" }, async () => {
        const fresh = await fetchSettings();
        if (cancelled) return;
        cachedSettings = fresh;
        setSettings(fresh);
        settingsListeners.forEach(fn => fn(fresh));
      })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  return { settings, loading };
}

export async function getSettings(): Promise<PlatformSettings> {
  if (cachedSettings) return cachedSettings;
  const s = await fetchSettings();
  cachedSettings = s;
  return s;
}
