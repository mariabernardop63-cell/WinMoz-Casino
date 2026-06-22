import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { ChevronLeft, Clock, Bell } from "lucide-react";

type GameConfig = {
  name: string;
  subtitle: string;
  description: string;
  features: string[];
  accent: string;
  accentMuted: string;
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
          "Partidas ao vivo contra jogadores reais",
          "Apostas a partir de 10 MT até 5.000 MT",
          "Torneios semanais com prémios em dinheiro",
        ],
        accent: "rgba(52,211,153,0.18)",
        accentMuted: "#34d399",
      };
    case "ravo":
      return {
        name: "Ravo Ravo",
        subtitle: "Jogo de Cartas",
        description:
          "O jogo de cartas mais popular de Moçambique, agora com apostas em dinheiro real.",
        features: [
          "Regras do Ravo Ravo tradicional",
          "Salas públicas e privadas",
          "Ligas mensais com grandes prémios",
        ],
        accent: "rgba(167,139,250,0.18)",
        accentMuted: "#a78bfa",
      };
    default:
      return {
        name: "Bilhar Apostado",
        subtitle: "Jogo de Mesa",
        description:
          "Precisão, ângulo e estratégia. Uma experiência de bilhar premium com apostas em tempo real.",
        features: [
          "5 modos de jogo diferentes",
          "Apostas de 10 a 5.000 MT",
          "Torneios e ligas semanais",
        ],
        accent: "rgba(34,211,238,0.14)",
        accentMuted: "#22d3ee",
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
      className="min-h-screen flex flex-col items-center justify-center px-6 relative overflow-hidden"
      style={{ background: "#08080f" }}
    >
      {/* Ambient glow */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse 70% 50% at 50% 20%, ${config.accent} 0%, transparent 70%)`,
          pointerEvents: "none",
        }}
      />

      {/* Back button */}
      <motion.button
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.05 }}
        onClick={() => setLocation("/")}
        style={{
          position: "absolute",
          top: 20,
          left: 16,
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 99,
          padding: "8px 16px",
          color: "rgba(255,255,255,0.7)",
          fontFamily: "'Syne', sans-serif",
          fontWeight: 700,
          fontSize: 13,
          cursor: "pointer",
          backdropFilter: "blur(8px)",
        }}
      >
        <ChevronLeft style={{ width: 15, height: 15 }} />
        Voltar
      </motion.button>

      {/* Main content */}
      <div className="flex flex-col items-center text-center w-full" style={{ maxWidth: 340 }}>

        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 99,
            padding: "5px 14px",
            marginBottom: 28,
          }}
        >
          <Clock style={{ width: 11, height: 11, color: config.accentMuted }} />
          <span
            style={{
              fontFamily: "'Syne', sans-serif",
              fontWeight: 700,
              fontSize: 10,
              color: config.accentMuted,
              letterSpacing: "1.4px",
              textTransform: "uppercase",
            }}
          >
            Em Breve
          </span>
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          style={{
            fontFamily: "'Syne', sans-serif",
            fontWeight: 800,
            fontSize: 34,
            color: "#ffffff",
            marginBottom: 8,
            lineHeight: 1.1,
            letterSpacing: "-0.8px",
          }}
        >
          {config.name}
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          style={{
            fontFamily: "'Syne', sans-serif",
            fontWeight: 600,
            fontSize: 12,
            color: config.accentMuted,
            letterSpacing: "1.6px",
            textTransform: "uppercase",
            marginBottom: 20,
          }}
        >
          {config.subtitle}
        </motion.p>

        {/* Divider */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.22, duration: 0.4 }}
          style={{
            width: 40,
            height: 1.5,
            background: `linear-gradient(90deg, transparent, ${config.accentMuted}, transparent)`,
            marginBottom: 24,
            borderRadius: 99,
          }}
        />

        {/* Description */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          style={{
            fontFamily: "system-ui, sans-serif",
            fontSize: 15,
            color: "rgba(255,255,255,0.5)",
            lineHeight: 1.65,
            marginBottom: 36,
          }}
        >
          {config.description}
        </motion.p>

        {/* Features */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.32 }}
          style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", marginBottom: 40 }}
        >
          {config.features.map((feat, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 12,
                padding: "13px 16px",
                textAlign: "left",
              }}
            >
              <div
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background: config.accentMuted,
                  flexShrink: 0,
                  boxShadow: `0 0 6px ${config.accentMuted}`,
                }}
              />
              <span
                style={{
                  fontFamily: "system-ui, sans-serif",
                  fontSize: 13,
                  color: "rgba(255,255,255,0.65)",
                  lineHeight: 1.4,
                }}
              >
                {feat}
              </span>
            </div>
          ))}
        </motion.div>

        {/* Notify button */}
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.42 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => setLocation("/")}
          style={{
            width: "100%",
            height: 52,
            borderRadius: 14,
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.12)",
            color: "#fff",
            fontFamily: "'Syne', sans-serif",
            fontWeight: 700,
            fontSize: 14,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            marginBottom: 12,
            backdropFilter: "blur(8px)",
            letterSpacing: "0.2px",
          }}
        >
          <Bell style={{ width: 15, height: 15, color: config.accentMuted }} />
          Notificar quando lançar
        </motion.button>

        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.48 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => setLocation("/")}
          style={{
            background: "transparent",
            border: "none",
            color: "rgba(255,255,255,0.35)",
            fontFamily: "system-ui, sans-serif",
            fontSize: 13,
            cursor: "pointer",
            padding: "8px 0",
          }}
        >
          Voltar ao início
        </motion.button>
      </div>
    </div>
  );
}
