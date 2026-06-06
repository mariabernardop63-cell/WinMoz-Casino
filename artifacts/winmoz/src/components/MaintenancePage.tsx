import { motion } from "framer-motion";
import { Wrench, Clock, Mail, Shield } from "lucide-react";

export default function MaintenancePage() {
  return (
    <div
      style={{
        minHeight: "100dvh",
        width: "100%",
        background: "linear-gradient(135deg, #0d0618 0%, #1a0533 40%, #2d0f6b 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Animated background orbs */}
      <motion.div
        animate={{ scale: [1, 1.15, 1], opacity: [0.12, 0.2, 0.12] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        style={{
          position: "absolute",
          top: "-10%",
          right: "-10%",
          width: 400,
          height: 400,
          borderRadius: "50%",
          background: "radial-gradient(circle, #7C3AED 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />
      <motion.div
        animate={{ scale: [1, 1.2, 1], opacity: [0.08, 0.15, 0.08] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        style={{
          position: "absolute",
          bottom: "-15%",
          left: "-10%",
          width: 500,
          height: 500,
          borderRadius: "50%",
          background: "radial-gradient(circle, #4f46e5 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      {/* Floating particles */}
      {[...Array(8)].map((_, i) => (
        <motion.div
          key={i}
          animate={{
            y: [0, -20, 0],
            opacity: [0.3, 0.7, 0.3],
          }}
          transition={{
            duration: 3 + i * 0.5,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.4,
          }}
          style={{
            position: "absolute",
            width: 4 + (i % 3) * 2,
            height: 4 + (i % 3) * 2,
            borderRadius: "50%",
            background: i % 2 === 0 ? "#7C3AED" : "#4f46e5",
            left: `${10 + i * 11}%`,
            top: `${15 + (i % 4) * 18}%`,
            opacity: 0.4,
            pointerEvents: "none",
          }}
        />
      ))}

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        style={{
          width: "100%",
          maxWidth: 420,
          position: "relative",
          zIndex: 10,
        }}
      >
        {/* Logo/Brand */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 20px",
              borderRadius: 100,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              marginBottom: 24,
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: "linear-gradient(135deg, #7C3AED, #4f46e5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="14" height="17" viewBox="0 0 18 26" fill="none">
                <path d="M1 1 L9 1 L6 25 L-2 25 Z" fill="#fff" />
                <path d="M11 1 L17 1 L14 25 L8 25 Z" fill="#fff" opacity="0.5" />
              </svg>
            </div>
            <span
              style={{
                color: "#fff",
                fontWeight: 700,
                fontSize: 14,
                letterSpacing: "0.5px",
              }}
            >
              Winmoz
            </span>
          </div>
        </div>

        {/* Main card */}
        <div
          style={{
            background: "rgba(255,255,255,0.04)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 28,
            padding: "40px 32px",
            textAlign: "center",
            boxShadow: "0 32px 80px rgba(0,0,0,0.5)",
          }}
        >
          {/* Icon */}
          <motion.div
            animate={{ rotate: [0, -8, 8, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            style={{
              width: 80,
              height: 80,
              borderRadius: 24,
              background: "linear-gradient(135deg, rgba(124,58,237,0.3), rgba(79,70,229,0.3))",
              border: "1.5px solid rgba(124,58,237,0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 28px",
              boxShadow: "0 8px 32px rgba(124,58,237,0.25)",
            }}
          >
            <Wrench style={{ width: 36, height: 36, color: "#a78bfa" }} />
          </motion.div>

          <h1
            style={{
              color: "#fff",
              fontSize: 26,
              fontWeight: 800,
              margin: "0 0 10px",
              letterSpacing: "-0.5px",
            }}
          >
            Em Manutenção
          </h1>

          <p
            style={{
              color: "rgba(255,255,255,0.55)",
              fontSize: 14,
              lineHeight: 1.65,
              margin: "0 0 32px",
            }}
          >
            A plataforma está temporariamente indisponível enquanto realizamos melhorias. Voltamos em breve com novidades!
          </p>

          {/* Animated progress */}
          <div
            style={{
              background: "rgba(255,255,255,0.06)",
              borderRadius: 100,
              height: 6,
              overflow: "hidden",
              marginBottom: 32,
            }}
          >
            <motion.div
              animate={{ x: ["-100%", "100%"] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
              style={{
                height: "100%",
                width: "40%",
                background: "linear-gradient(90deg, transparent, #7C3AED, #a78bfa, transparent)",
                borderRadius: 100,
              }}
            />
          </div>

          {/* Info cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
              marginBottom: 32,
            }}
          >
            {[
              {
                icon: Clock,
                title: "Tempo Previsto",
                value: "Em breve",
                color: "#a78bfa",
              },
              {
                icon: Shield,
                title: "Segurança",
                value: "Activa",
                color: "#34d399",
              },
            ].map((item) => (
              <div
                key={item.title}
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 16,
                  padding: "14px 12px",
                }}
              >
                <item.icon
                  style={{ width: 18, height: 18, color: item.color, margin: "0 auto 6px" }}
                />
                <div
                  style={{
                    fontSize: 10,
                    color: "rgba(255,255,255,0.4)",
                    textTransform: "uppercase",
                    letterSpacing: "0.8px",
                    marginBottom: 3,
                  }}
                >
                  {item.title}
                </div>
                <div
                  style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}
                >
                  {item.value}
                </div>
              </div>
            ))}
          </div>

          {/* Contact */}
          <a
            href="mailto:support@pokerw.co.mz"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 20px",
              borderRadius: 100,
              background: "rgba(124,58,237,0.15)",
              border: "1px solid rgba(124,58,237,0.3)",
              color: "#a78bfa",
              fontSize: 13,
              fontWeight: 500,
              textDecoration: "none",
              cursor: "pointer",
            }}
          >
            <Mail style={{ width: 14, height: 14 }} />
            support@pokerw.co.mz
          </a>
        </div>

        <p
          style={{
            textAlign: "center",
            color: "rgba(255,255,255,0.2)",
            fontSize: 11,
            marginTop: 20,
          }}
        >
          © 2025 Winmoz · Todos os direitos reservados
        </p>
      </motion.div>
    </div>
  );
}
