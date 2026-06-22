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

function buildConfig(map: Record<string, string>): BrandConfig {
  const isPW = map["poker_winner_mode"] === "true";
  return {
    isPokerWinner: isPW,
    brandName: isPW ? "POKER" : "MOZBET",
    brandSubtitle: isPW ? "Winner Online" : "MOZAMBIQUE",
    whatsappUrl: map["whatsapp_group_url"] ?? "",
  };
}

export function BrandProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<BrandConfig>(defaults);

  useEffect(() => {
    document.title = config.isPokerWinner
      ? "Poker Winner - Jogos e Apostas"
      : "MozBet - Jogos e Apostas";
  }, [config.isPokerWinner]);

  useEffect(() => {
    adminSupabase
      .from("platform_settings")
      .select("key, value")
      .in("key", ["poker_winner_mode", "whatsapp_group_url"])
      .then(({ data }) => {
        if (!data) return;
        const map: Record<string, string> = {};
        for (const row of data) map[row.key as string] = row.value as string;
        setConfig(buildConfig(map));
      });

    const channel = adminSupabase
      .channel("brand-settings-watch")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "platform_settings" },
        (payload) => {
          const rec = payload.new as { key?: string; value?: string } | undefined;
          if (!rec?.key) return;
          if (rec.key === "poker_winner_mode" || rec.key === "whatsapp_group_url") {
            setConfig(prev => {
              const map: Record<string, string> = {
                poker_winner_mode: prev.isPokerWinner ? "true" : "false",
                whatsapp_group_url: prev.whatsappUrl,
                [rec.key!]: rec.value ?? "",
              };
              return buildConfig(map);
            });
          }
        }
      )
      .subscribe();

    return () => { adminSupabase.removeChannel(channel); };
  }, []);

  return <BrandContext.Provider value={config}>{children}</BrandContext.Provider>;
}

export function useBrand() {
  return useContext(BrandContext);
}
