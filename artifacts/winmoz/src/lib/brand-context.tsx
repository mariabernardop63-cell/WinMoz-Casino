import { createContext, useContext, useEffect, useState } from "react";
import { adminSupabase } from "@/admin/lib/supabase-api";

export interface BrandConfig {
  isPokerWinner: boolean;
  brandName: string;
  brandSubtitle: string;
  whatsappUrl: string;
}

const defaults: BrandConfig = {
  isPokerWinner: false,
  brandName: "MOZBET",
  brandSubtitle: "MOZAMBIQUE",
  whatsappUrl: "",
};

const BrandContext = createContext<BrandConfig>(defaults);

function ensureAbsoluteUrl(url: string): string {
  if (!url) return "";
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function buildConfig(map: Record<string, string>): BrandConfig {
  const isPW = map["poker_winner_mode"] === "true";
  return {
    isPokerWinner: isPW,
    brandName: isPW ? "POKER" : "MOZBET",
    brandSubtitle: isPW ? "Winner Online" : "MOZAMBIQUE",
    whatsappUrl: ensureAbsoluteUrl(map["whatsapp_group_url"] ?? ""),
  };
}

export function BrandProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<BrandConfig>(defaults);

  /* Título do separador acompanha o branding activo */
  useEffect(() => {
    document.title = config.isPokerWinner
      ? "Poker Winner - Jogos e Apostas Online"
      : "Mozbet - Jogos e Apostas Online em Moçambique";
  }, [config.isPokerWinner]);

  useEffect(() => {
    const map: Record<string, string> = {};

    const applyConfig = () => { setConfig(buildConfig(map)); };

    /* 1. Fonte primária: API server-side (service role, nunca bloqueada
          por RLS) — o mesmo caminho que o MaintenanceGate usa */
    const loadViaApi = async () => {
      try {
        const [pw, wa] = await Promise.all([
          fetch("/api/admin/settings?key=poker_winner_mode").then(r => r.ok ? r.json() : null).catch(() => null),
          fetch("/api/admin/settings?key=whatsapp_group_url").then(r => r.ok ? r.json() : null).catch(() => null),
        ]);
        const pwVal = (pw as { setting?: { value?: string } | null })?.setting?.value;
        const waVal = (wa as { setting?: { value?: string } | null })?.setting?.value;
        let changed = false;
        if (pwVal !== undefined && map["poker_winner_mode"] !== pwVal) { map["poker_winner_mode"] = pwVal; changed = true; }
        if (waVal !== undefined && map["whatsapp_group_url"] !== waVal) { map["whatsapp_group_url"] = waVal; changed = true; }
        if (changed) applyConfig();
      } catch { /* ignora — fallback abaixo */ }
    };

    /* 2. Fallback: leitura directa Supabase (anon) — funciona se a API estiver em baixo */
    adminSupabase
      .from("platform_settings")
      .select("key, value")
      .in("key", ["poker_winner_mode", "whatsapp_group_url"])
      .then(({ data }) => {
        if (!data) return;
        for (const row of data) {
          if (map[row.key as string] === undefined) map[row.key as string] = row.value as string;
        }
        applyConfig();
      });

    loadViaApi();

    /* 3. Polling: mudanças do admin aparecem em ≤ 20 s em todas as sessões
          abertas, mesmo que o Realtime não entregue o evento */
    const interval = setInterval(loadViaApi, 20_000);

    /* 4. Realtime como bónus — recebe mudanças imediatamente quando funciona */
    const channel = adminSupabase
      .channel("brand-settings-watch")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "platform_settings" },
        (payload) => {
          const rec = payload.new as { key?: string; value?: string } | undefined;
          if (!rec?.key) return;
          if (rec.key === "poker_winner_mode" || rec.key === "whatsapp_group_url") {
            map[rec.key] = rec.value ?? "";
            applyConfig();
          }
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      adminSupabase.removeChannel(channel);
    };
  }, []);

  return <BrandContext.Provider value={config}>{children}</BrandContext.Provider>;
}

export function useBrand() {
  return useContext(BrandContext);
}
