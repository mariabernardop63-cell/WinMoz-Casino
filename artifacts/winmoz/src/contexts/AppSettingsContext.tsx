import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";

export type Language = "Português" | "English" | "Français" | "Español";
export type Currency = "MZN" | "USD" | "EUR" | "ZAR" | "BRL";

export interface PaymentMethod {
  id: string;
  phone: string;
  label: string;
  isDefault: boolean;
}

export interface BettingLimits {
  enabled: boolean;
  dailyLimit: number;
  todaySpent: number;
  lastResetDate: string;
}

interface ExchangeRates {
  MZN: number;
  USD: number;
  EUR: number;
  ZAR: number;
  BRL: number;
  updatedAt: number;
}

interface AppSettings {
  darkMode: boolean;
  language: Language;
  currency: Currency;
  exchangeRates: ExchangeRates;
  paymentMethods: PaymentMethod[];
  bettingLimits: BettingLimits;
  setDarkMode: (v: boolean) => void;
  setLanguage: (v: Language) => void;
  setCurrency: (v: Currency) => void;
  addPaymentMethod: (phone: string, label: string) => boolean;
  removePaymentMethod: (id: string) => void;
  setDefaultPaymentMethod: (id: string) => void;
  getDefaultPhone: () => string;
  setBettingLimits: (v: Partial<BettingLimits>) => void;
  recordBet: (amount: number) => boolean;
  convertAmount: (amountMZN: number) => { value: number; symbol: string; formatted: string };
  t: (pt: string, en?: string, fr?: string, es?: string) => string;
}

const CURRENCY_SYMBOLS: Record<Currency, string> = {
  MZN: "MT", USD: "$", EUR: "€", ZAR: "R", BRL: "R$",
};

const FALLBACK_RATES: ExchangeRates = {
  MZN: 1, USD: 0.0157, EUR: 0.0145, ZAR: 0.292, BRL: 0.0785,
  updatedAt: 0,
};

const STORAGE_KEY = "wm_app_settings_v2";

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Partial<AppSettings & { exchangeRates: ExchangeRates; paymentMethods: PaymentMethod[]; bettingLimits: BettingLimits }>;
  } catch {}
  return null;
}

function saveSettings(data: object) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
}

const AppSettingsContext = createContext<AppSettings | null>(null);

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const saved = loadSettings();

  const [darkMode, setDarkModeState] = useState<boolean>(false);
  const [language, setLanguageState] = useState<Language>((saved as any)?.language ?? "Português");
  const [currency, setCurrencyState] = useState<Currency>("MZN");
  const [exchangeRates, setExchangeRates] = useState<ExchangeRates>((saved as any)?.exchangeRates ?? FALLBACK_RATES);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>((saved as any)?.paymentMethods ?? []);
  const [bettingLimits, setBettingLimitsState] = useState<BettingLimits>(
    (saved as any)?.bettingLimits ?? { enabled: false, dailyLimit: 500, todaySpent: 0, lastResetDate: new Date().toDateString() }
  );

  const persistRef = useRef({ darkMode, language, currency, exchangeRates, paymentMethods, bettingLimits });

  useEffect(() => {
    persistRef.current = { darkMode, language, currency, exchangeRates, paymentMethods, bettingLimits };
    saveSettings(persistRef.current);
  }, [darkMode, language, currency, exchangeRates, paymentMethods, bettingLimits]);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
      document.documentElement.style.colorScheme = "dark";
    } else {
      document.documentElement.classList.remove("dark");
      document.documentElement.style.colorScheme = "light";
    }
  }, [darkMode]);

  useEffect(() => {
    document.documentElement.lang = language === "English" ? "en" : language === "Français" ? "fr" : language === "Español" ? "es" : "pt";
  }, [language]);

  useEffect(() => {
    const now = Date.now();
    if (now - exchangeRates.updatedAt < 3600_000) return;
    fetch("https://open.er-api.com/v6/latest/MZN")
      .then(r => r.json())
      .then((data: any) => {
        if (data?.rates) {
          setExchangeRates({
            MZN: 1,
            USD: data.rates.USD ?? FALLBACK_RATES.USD,
            EUR: data.rates.EUR ?? FALLBACK_RATES.EUR,
            ZAR: data.rates.ZAR ?? FALLBACK_RATES.ZAR,
            BRL: data.rates.BRL ?? FALLBACK_RATES.BRL,
            updatedAt: Date.now(),
          });
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const today = new Date().toDateString();
    if (bettingLimits.lastResetDate !== today) {
      setBettingLimitsState(prev => ({ ...prev, todaySpent: 0, lastResetDate: today }));
    }
  }, []);

  const setDarkMode = useCallback((v: boolean) => setDarkModeState(v), []);
  const setLanguage = useCallback((v: Language) => setLanguageState(v), []);
  const setCurrency = useCallback((v: Currency) => setCurrencyState(v), []);

  const addPaymentMethod = useCallback((phone: string, label: string): boolean => {
    if (paymentMethods.length >= 3) return false;
    const id = `pm_${Date.now()}`;
    setPaymentMethods(prev => [...prev, { id, phone, label, isDefault: prev.length === 0 }]);
    return true;
  }, [paymentMethods.length]);

  const removePaymentMethod = useCallback((id: string) => {
    setPaymentMethods(prev => {
      const filtered = prev.filter(m => m.id !== id);
      if (filtered.length > 0 && !filtered.some(m => m.isDefault)) {
        filtered[0].isDefault = true;
      }
      return filtered;
    });
  }, []);

  const setDefaultPaymentMethod = useCallback((id: string) => {
    setPaymentMethods(prev => prev.map(m => ({ ...m, isDefault: m.id === id })));
  }, []);

  const getDefaultPhone = useCallback(() => {
    return paymentMethods.find(m => m.isDefault)?.phone ?? "";
  }, [paymentMethods]);

  const setBettingLimits = useCallback((v: Partial<BettingLimits>) => {
    setBettingLimitsState(prev => ({ ...prev, ...v }));
  }, []);

  const recordBet = useCallback((amount: number): boolean => {
    const today = new Date().toDateString();
    let current = bettingLimits;
    if (current.lastResetDate !== today) {
      current = { ...current, todaySpent: 0, lastResetDate: today };
    }
    if (!current.enabled) return true;
    if (current.todaySpent + amount > current.dailyLimit) return false;
    setBettingLimitsState(prev => ({ ...prev, todaySpent: prev.todaySpent + amount, lastResetDate: today }));
    return true;
  }, [bettingLimits]);

  const convertAmount = useCallback((amountMZN: number) => {
    const rate = exchangeRates[currency];
    const value = parseFloat((amountMZN * rate).toFixed(2));
    const symbol = CURRENCY_SYMBOLS[currency];
    const formatted = currency === "MZN"
      ? `${amountMZN.toLocaleString("pt-PT")} MT`
      : `${symbol} ${value.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    return { value, symbol, formatted };
  }, [currency, exchangeRates]);

  const t = useCallback((pt: string, en?: string, fr?: string, es?: string): string => {
    if (language === "English" && en) return en;
    if (language === "Français" && fr) return fr;
    if (language === "Español" && es) return es;
    return pt;
  }, [language]);

  return (
    <AppSettingsContext.Provider value={{
      darkMode, language, currency, exchangeRates, paymentMethods, bettingLimits,
      setDarkMode, setLanguage, setCurrency,
      addPaymentMethod, removePaymentMethod, setDefaultPaymentMethod, getDefaultPhone,
      setBettingLimits, recordBet, convertAmount, t,
    }}>
      {children}
    </AppSettingsContext.Provider>
  );
}

export function useAppSettings(): AppSettings {
  const ctx = useContext(AppSettingsContext);
  if (!ctx) throw new Error("useAppSettings must be used inside AppSettingsProvider");
  return ctx;
}
