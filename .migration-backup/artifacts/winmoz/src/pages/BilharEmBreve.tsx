import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { ChevronLeft, Clock } from "lucide-react";

export default function BilharEmBreve() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-[#0a0a14] flex flex-col items-center justify-center px-6 relative overflow-hidden">

      {/* Background glow */}
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 80% 60% at 50% 30%, rgba(8,145,178,0.18) 0%, transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", top: "10%", left: "20%", width: 180, height: 180, borderRadius: "50%", background: "rgba(8,145,178,0.07)", filter: "blur(40px)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "15%", right: "15%", width: 140, height: 140, borderRadius: "50%", background: "rgba(0,212,180,0.06)", filter: "blur(35px)", pointerEvents: "none" }} />

      {/* Back button */}
      <motion.button
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1 }}
        onClick={() => setLocation("/")}
        style={{
          position: "absolute",
          top: 20,
          left: 16,
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: "rgba(255,255,255,0.08)",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 99,
          padding: "8px 16px",
          color: "#e4e4e7",
          fontFamily: "'Syne', sans-serif",
          fontWeight: 700,
          fontSize: 13,
          cursor: "pointer",
          backdropFilter: "blur(8px)",
        }}
      >
        <ChevronLeft style={{ width: 16, height: 16 }} />
        Voltar
      </motion.button>

      {/* Main content */}
      <div className="flex flex-col items-center text-center max-w-[320px] w-full">

        {/* Icon ring */}
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", damping: 14, stiffness: 180, delay: 0.15 }}
          style={{ position: "relative", marginBottom: 32 }}
        >
          {/* Outer pulse ring */}
          <motion.div
            animate={{ scale: [1, 1.18, 1], opacity: [0.4, 0, 0.4] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeOut" }}
            style={{ position: "absolute", inset: -18, borderRadius: "50%", border: "2px solid rgba(8,145,178,0.5)" }}
          />
          {/* Middle ring */}
          <motion.div
            animate={{ scale: [1, 1.12, 1], opacity: [0.3, 0, 0.3] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeOut", delay: 0.8 }}
            style={{ position: "absolute", inset: -10, borderRadius: "50%", border: "1.5px solid rgba(0,212,180,0.4)" }}
          />
          {/* Icon container */}
          <div style={{
            width: 96,
            height: 96,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #0891b2 0%, #164e63 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 12px 40px rgba(8,145,178,0.45), 0 4px 16px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.2)",
          }}>
            {/* Custom billiard cue + ball SVG */}
            <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
              {/* Cue stick */}
              <line x1="10" y1="42" x2="40" y2="12" stroke="white" strokeWidth="3" strokeLinecap="round" strokeOpacity="0.9"/>
              {/* Ball 1 - main */}
              <circle cx="35" cy="22" r="9" fill="white" fillOpacity="0.95"/>
              <circle cx="35" cy="22" r="9" stroke="rgba(8,145,178,0.3)" strokeWidth="1"/>
              {/* Number stripe */}
              <path d="M 27 19 Q 35 14 43 19 Q 35 30 27 19 Z" fill="#0891b2" fillOpacity="0.7"/>
              {/* Ball 2 - small */}
              <circle cx="20" cy="35" r="5.5" fill="white" fillOpacity="0.7"/>
              <circle cx="20" cy="35" r="5.5" stroke="rgba(255,255,255,0.2)" strokeWidth="0.5"/>
              {/* Ball 3 - tiny */}
              <circle cx="12" cy="28" r="3.5" fill="white" fillOpacity="0.45"/>
            </svg>
          </div>
        </motion.div>

        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "rgba(8,145,178,0.15)",
            border: "1px solid rgba(8,145,178,0.35)",
            borderRadius: 99,
            padding: "5px 14px",
            marginBottom: 18,
          }}
        >
          <Clock style={{ width: 12, height: 12, color: "#22d3ee" }} />
          <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 11, color: "#22d3ee", letterSpacing: "1.2px", textTransform: "uppercase" }}>
            Em Breve
          </span>
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          style={{
            fontFamily: "'Syne', sans-serif",
            fontWeight: 800,
            fontSize: 30,
            color: "#ffffff",
            marginBottom: 14,
            lineHeight: 1.15,
            letterSpacing: "-0.5px",
          }}
        >
          Bilhar Apostado
        </motion.h1>

        {/* Description */}
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          style={{
            fontFamily: "system-ui, sans-serif",
            fontSize: 15,
            color: "#a1a1aa",
            lineHeight: 1.6,
            marginBottom: 36,
          }}
        >
          Estamos a preparar uma experiência de bilhar premium com apostas em tempo real. Será lançado em breve.
        </motion.p>

        {/* Features preview */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.48 }}
          style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", marginBottom: 36 }}
        >
          {[
            { icon: "🎱", text: "5 modos de jogo diferentes" },
            { icon: "⚡", text: "Apostas de 10 a 5.000 MT" },
            { icon: "🏆", text: "Torneios e ligas semanais" },
          ].map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.52 + i * 0.08 }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 12,
                padding: "12px 16px",
              }}
            >
              <span style={{ fontSize: 18 }}>{item.icon}</span>
              <span style={{ fontFamily: "system-ui, sans-serif", fontSize: 13, color: "#d4d4d8" }}>{item.text}</span>
            </motion.div>
          ))}
        </motion.div>

        {/* Back button */}
        <motion.button
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.62 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => setLocation("/")}
          style={{
            width: "100%",
            height: 54,
            borderRadius: 99,
            background: "linear-gradient(135deg, #0891b2 0%, #164e63 100%)",
            border: "none",
            color: "#fff",
            fontFamily: "'Syne', sans-serif",
            fontWeight: 800,
            fontSize: 15,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            boxShadow: "0 8px 28px rgba(8,145,178,0.4), inset 0 1px 0 rgba(255,255,255,0.15)",
            letterSpacing: "0.3px",
          }}
        >
          <ChevronLeft style={{ width: 18, height: 18 }} />
          Voltar ao Início
        </motion.button>
      </div>
    </div>
  );
}
