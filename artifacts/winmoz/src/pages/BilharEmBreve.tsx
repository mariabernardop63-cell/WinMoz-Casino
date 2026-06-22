import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowLeft, Clock, Sparkles, Trophy, Zap } from "lucide-react";

type GameConfig = {
  name: string;
  subtitle: string;
  description: string;
  features: { icon: React.ReactNode; text: string }[];
  accent: string;
  accentRgb: string;
};

function getGameConfig(jogo: string): GameConfig {
  switch (jogo) {
    case "carta":
      return {
        name: "Carta da Mesa",
        subtitle: "Jogo de Cartas",
        description:
          "Uma experiência premium de cartas com apostas ao vivo. Blefe, estratégia e sorte num só jogo.",
        features: [
          { icon: <Zap style={{ width: 12, height: 12 }} />, text: "Partidas ao vivo contra jogadores reais" },
          { icon: <Trophy style={{ width: 12, height: 12 }} />, text: "Apostas a partir de 10 MT até 5.000 MT" },
          { icon: <Sparkles style={{ width: 12, height: 12 }} />, text: "Torneios semanais com prémios em dinheiro" },
        ],
        accent: "#34d399",
        accentRgb: "52,211,153",
      };
    case "ravo":
      return {
        name: "Ravo Ravo",
        subtitle: "Jogo de Cartas",
        description:
          "O jogo de cartas mais popular de Moçambique, agora com apostas em dinheiro real.",
        features: [
          { icon: <Zap style={{ width: 12, height: 12 }} />, text: "Regras do Ravo Ravo tradicional" },
          { icon: <Trophy style={{ width: 12, height: 12 }} />, text: "Salas públicas e privadas" },
          { icon: <Sparkles style={{ width: 12, height: 12 }} />, text: "Ligas mensais com grandes prémios" },
        ],
        accent: "#a78bfa",
        accentRgb: "167,139,250",
      };
    default:
      return {
        name: "Bilhar Apostado",
        subtitle: "Jogo de Mesa",
        description:
          "Precisão, ângulo e estratégia. Uma experiência de bilhar premium com apostas em tempo real.",
        features: [
          { icon: <Zap style={{ width: 12, height: 12 }} />, text: "5 modos de jogo diferentes" },
          { icon: <Trophy style={{ width: 12, height: 12 }} />, text: "Apostas de 10 a 5.000 MT" },
          { icon: <Sparkles style={{ width: 12, height: 12 }} />, text: "Torneios e ligas semanais" },
        ],
        accent: "#22d3ee",
        accentRgb: "34,211,238",
      };
  }
}

export default function BilharEmBreve() {
  const [, setLocation] = useLocation();
  const params = new URLSearchParams(
    typeof window !== "undefined" ? window.location.search : ""
  );
  const jogo = params.get("jogo") || "bilhar";
  const config = getGameConfig(jogo);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#ffffff",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Top stripe accent */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: config.accent,
        }}
      />

      {/* Subtle background pattern */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `radial-gradient(circle at 80% 10%, rgba(${config.accentRgb},0.06) 0%, transparent 50%), radial-gradient(circle at 20% 90%, rgba(${config.accentRgb},0.04) 0%, transparent 50%)`,
          pointerEvents: "none",
        }}
      />

      {/* Header */}
      <div style={{ padding: "20px 20px 0", position: "relative" }}>
        <motion.button
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          onClick={() => setLocation("/")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "none",
            border: "none",
            padding: "8px 0",
            color: "#6b7280",
            fontFamily: "'Syne', sans-serif",
            fontWeight: 600,
            fontSize: 13,
            cursor: "pointer",
            letterSpacing: "0.2px",
          }}
        >
          <ArrowLeft style={{ width: 15, height: 15 }} />
          Voltar
        </motion.button>
      </div>

      {/* Main content */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "32px 24px 48px",
          position: "relative",
        }}
      >
        <div style={{ width: "100%", maxWidth: 360 }}>

          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: `rgba(${config.accentRgb},0.08)`,
              border: `1px solid rgba(${config.accentRgb},0.2)`,
              borderRadius: 99,
              padding: "5px 14px",
              marginBottom: 28,
            }}
          >
            <Clock style={{ width: 11, height: 11, color: config.accent }} />
            <span
              style={{
                fontFamily: "'Syne', sans-serif",
                fontWeight: 800,
                fontSize: 10,
                color: config.accent,
                letterSpacing: "1.8px",
                textTransform: "uppercase",
              }}
            >
              Em Breve
            </span>
          </motion.div>

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.07 }}
            style={{
              fontFamily: "'Syne', sans-serif",
              fontWeight: 900,
              fontSize: 38,
              color: "#0d0d0d",
              marginBottom: 6,
              lineHeight: 1.05,
              letterSpacing: "-1px",
            }}
          >
            {config.name}
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.35, delay: 0.12 }}
            style={{
              fontFamily: "'Syne', sans-serif",
              fontWeight: 600,
              fontSize: 11,
              color: config.accent,
              letterSpacing: "2px",
              textTransform: "uppercase",
              marginBottom: 24,
            }}
          >
            {config.subtitle}
          </motion.p>

          {/* Divider */}
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.45, delay: 0.15 }}
            style={{
              width: 32,
              height: 2,
              background: "#0d0d0d",
              marginBottom: 24,
              borderRadius: 99,
              transformOrigin: "left",
            }}
          />

          {/* Description */}
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.38, delay: 0.18 }}
            style={{
              fontSize: 15,
              color: "#6b7280",
              lineHeight: 1.7,
              marginBottom: 32,
              fontFamily: "system-ui, sans-serif",
            }}
          >
            {config.description}
          </motion.p>

          {/* Features */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.38, delay: 0.24 }}
            style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 40 }}
          >
            {config.features.map((feat, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "14px 16px",
                  border: "1px solid #f0f0f0",
                  borderRadius: 12,
                  background: "#fafafa",
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: `rgba(${config.accentRgb},0.1)`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: config.accent,
                    flexShrink: 0,
                  }}
                >
                  {feat.icon}
                </div>
                <span
                  style={{
                    fontSize: 13,
                    color: "#374151",
                    fontFamily: "system-ui, sans-serif",
                    lineHeight: 1.4,
                  }}
                >
                  {feat.text}
                </span>
              </div>
            ))}
          </motion.div>

          {/* CTA button */}
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.32 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setLocation("/")}
            style={{
              width: "100%",
              height: 52,
              borderRadius: 0,
              background: "#0d0d0d",
              border: "none",
              color: "#fff",
              fontFamily: "'Syne', sans-serif",
              fontWeight: 800,
              fontSize: 14,
              cursor: "pointer",
              letterSpacing: "0.6px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              marginBottom: 12,
            }}
          >
            Voltar ao Início
          </motion.button>

          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.4 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setLocation("/")}
            style={{
              width: "100%",
              background: "transparent",
              border: "1px solid #e5e7eb",
              borderRadius: 0,
              color: "#9ca3af",
              fontFamily: "system-ui, sans-serif",
              fontSize: 13,
              cursor: "pointer",
              padding: "14px 0",
              letterSpacing: "0.3px",
            }}
          >
            Explorar outros jogos
          </motion.button>

        </div>
      </div>
    </div>
  );
}
