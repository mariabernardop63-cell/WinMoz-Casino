import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowLeft, Clock, Bell, CheckCircle } from "lucide-react";
import { useBrand } from "@/lib/brand-context";

type GameConfig = {
  name: string;
  subtitle: string;
  description: string;
  features: string[];
  tag: string;
};

function getGameConfig(jogo: string): GameConfig {
  switch (jogo) {
    case "carta":
      return {
        name: "Carta da Mesa",
        subtitle: "Jogo de Cartas",
        tag: "CARTAS",
        description:
          "Uma experiência premium de cartas com apostas ao vivo. Blefe, estratégia e sorte num só jogo.",
        features: [
          "Partidas ao vivo contra jogadores reais",
          "Apostas a partir de 10 MT até 5.000 MT",
          "Torneios semanais com prémios em dinheiro",
        ],
      };
    case "ravo":
      return {
        name: "Ravo Ravo",
        subtitle: "Jogo de Cartas",
        tag: "CARTAS",
        description:
          "O jogo de cartas mais popular de Moçambique, agora com apostas em dinheiro real.",
        features: [
          "Regras do Ravo Ravo tradicional",
          "Salas públicas e privadas",
          "Ligas mensais com grandes prémios",
        ],
      };
    default:
      return {
        name: "Bilhar Apostado",
        subtitle: "Jogo de Mesa",
        tag: "MESA",
        description:
          "Precisão, ângulo e estratégia. Uma experiência de bilhar premium com apostas em tempo real.",
        features: [
          "5 modos de jogo diferentes",
          "Apostas de 10 a 5.000 MT",
          "Torneios e ligas semanais",
        ],
      };
  }
}

function BrandLogo() {
  const { brandName, brandSubtitle } = useBrand();
  return (
    <svg viewBox="0 0 190 46" height="36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M1 2 L11 2 L7 44 L0 44 Z" fill="#0D0D0D" />
      <path d="M13 2 L20 2 L16 44 L10 44 Z" fill="#0D0D0D" opacity="0.18" />
      <text x="23" y="27" fontFamily="'Syne', sans-serif" fontWeight="800" fontSize="22" letterSpacing="0.5" fill="#0D0D0D">{brandName}</text>
      <text x="23" y="41" fontFamily="'Syne', sans-serif" fontWeight="300" fontSize="11" letterSpacing="3" fill="#0D0D0D">{brandSubtitle}</text>
    </svg>
  );
}

export default function BilharEmBreve() {
  const [, setLocation] = useLocation();
  const params = new URLSearchParams(
    typeof window !== "undefined" ? window.location.search : ""
  );
  const jogo = params.get("jogo") || "bilhar";
  const config = getGameConfig(jogo);

  return (
    <div className="min-h-screen bg-white w-full flex justify-center">
      <div className="w-full max-w-[430px] min-h-screen bg-white flex flex-col px-6 pt-14 pb-10 relative">

        {/* Back button */}
        <button onClick={() => setLocation("/")}
          className="absolute top-5 left-5 flex items-center justify-center transition-colors hover:bg-slate-100"
          style={{ width: 36, height: 36 }}>
          <ArrowLeft style={{ width: 22, height: 22, color: "#111" }} />
        </button>

        {/* Logo */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32 }}
          className="flex justify-center mb-10">
          <BrandLogo />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.36, delay: 0.07 }}>

          {/* Em Breve tag */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 14,
            border: "1px solid #e5e7eb", padding: "5px 12px" }}>
            <Clock style={{ width: 10, height: 10, color: "#9ca3af" }} />
            <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 9.5,
              color: "#9ca3af", letterSpacing: "1.8px", textTransform: "uppercase" }}>
              Em Breve · {config.tag}
            </span>
          </div>

          {/* Title */}
          <h1 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 30,
            color: "#0a0a0a", lineHeight: 1.1, letterSpacing: "-0.6px", marginBottom: 8 }}>
            {config.name}
          </h1>
          <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 500, fontSize: 13,
            color: "#9ca3af", letterSpacing: "0.3px", marginBottom: 20 }}>
            {config.subtitle}
          </p>

          {/* Divider */}
          <div style={{ height: 1, background: "#f1f5f9", marginBottom: 20 }} />

          {/* Description */}
          <p style={{ fontSize: 14.5, color: "#6b7280", lineHeight: 1.7, marginBottom: 28 }}>
            {config.description}
          </p>

          {/* Features */}
          <div style={{ display: "flex", flexDirection: "column", gap: 0, marginBottom: 32,
            border: "1px solid #e5e7eb" }}>
            {config.features.map((feat, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12,
                padding: "14px 16px",
                borderBottom: i < config.features.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                <CheckCircle style={{ width: 14, height: 14, color: "#0a0a0a", flexShrink: 0, marginTop: 1.5 }} />
                <span style={{ fontSize: 13.5, color: "#374151", lineHeight: 1.45 }}>{feat}</span>
              </div>
            ))}
          </div>

          {/* Notify button */}
          <button onClick={() => setLocation("/")}
            style={{ width: "100%", padding: "15px", background: "#000", color: "#fff",
              fontSize: 14.5, fontWeight: 700, border: "none", borderRadius: 0,
              cursor: "pointer", letterSpacing: "0.3px",
              fontFamily: "'Syne', sans-serif",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              marginBottom: 12 }}>
            <Bell style={{ width: 15, height: 15 }} />
            Notificar quando lançar
          </button>

          <button onClick={() => setLocation("/")}
            style={{ width: "100%", padding: "14px", background: "none", color: "#6b7280",
              fontSize: 13.5, fontWeight: 600, border: "1px solid #e5e7eb", borderRadius: 0,
              cursor: "pointer", fontFamily: "inherit" }}>
            Voltar ao início
          </button>

        </motion.div>
      </div>
    </div>
  );
}
