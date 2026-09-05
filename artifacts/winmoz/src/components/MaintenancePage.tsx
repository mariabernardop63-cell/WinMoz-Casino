import { motion } from "framer-motion";
import { ArrowUpRight, CheckCircle2, LockKeyhole, Sparkles } from "lucide-react";

const details = [
  {
    icon: LockKeyhole,
    label: "Acesso",
    value: "Apenas autorizado",
    tone: "purple",
  },
  {
    icon: CheckCircle2,
    label: "Estado",
    value: "Desenvolvimento ativo",
    tone: "green",
  },
];

function BrandMark() {
  return (
    <div
      aria-hidden="true"
      style={{
        width: 38,
        height: 38,
        display: "grid",
        placeItems: "center",
        background: "#111827",
        color: "#fff",
        flexShrink: 0,
      }}
    >
      <svg width="18" height="24" viewBox="0 0 18 26" fill="none">
        <path d="M1 1 L9 1 L6 25 L-2 25 Z" fill="currentColor" />
        <path d="M11 1 L17 1 L14 25 L8 25 Z" fill="currentColor" opacity="0.48" />
      </svg>
    </div>
  );
}

export default function MaintenancePage() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        width: "100%",
        background: "#f8f9fc",
        color: "#111827",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
        fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          width: 620,
          height: 620,
          right: "-18%",
          top: "-32%",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(108,92,231,0.14) 0%, rgba(108,92,231,0.04) 38%, transparent 70%)",
          pointerEvents: "none",
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          width: 520,
          height: 520,
          left: "-24%",
          bottom: "-34%",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(16,185,129,0.07) 0%, rgba(16,185,129,0.02) 42%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      <header
        style={{
          width: "100%",
          maxWidth: 1120,
          margin: "0 auto",
          padding: "28px clamp(20px, 5vw, 56px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <BrandMark />
          <span
            style={{
              fontSize: 17,
              fontWeight: 800,
              letterSpacing: "-0.04em",
              color: "#111827",
            }}
          >
            Winmoz
          </span>
        </div>

        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 12px",
            border: "1px solid #e5e7eb",
            background: "rgba(255,255,255,0.72)",
            color: "#4b5563",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: "#6c5ce7",
              boxShadow: "0 0 0 4px rgba(108,92,231,0.12)",
            }}
          />
          Acesso restrito
        </div>
      </header>

      <section
        style={{
          width: "100%",
          maxWidth: 1120,
          margin: "auto",
          padding: "56px clamp(20px, 5vw, 56px) 72px",
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.05fr) minmax(300px, 0.95fr)",
          alignItems: "center",
          gap: "clamp(44px, 9vw, 120px)",
          position: "relative",
          zIndex: 1,
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              color: "#6c5ce7",
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              marginBottom: 22,
            }}
          >
            <Sparkles size={15} strokeWidth={2.2} />
            Uma nova experiência está a caminho
          </div>

          <h1
            style={{
              margin: 0,
              maxWidth: 650,
              color: "#111827",
              fontSize: "clamp(42px, 6vw, 76px)",
              lineHeight: 0.98,
              fontWeight: 850,
              letterSpacing: "-0.075em",
            }}
          >
            Em
            <br />
            <span style={{ color: "#6c5ce7" }}>desenvolvimento.</span>
          </h1>

          <p
            style={{
              maxWidth: 520,
              margin: "28px 0 0",
              color: "#5f6878",
              fontSize: "clamp(16px, 2vw, 18px)",
              lineHeight: 1.7,
            }}
          >
            A plataforma Winmoz ainda está em desenvolvimento. Estamos a
            preparar uma experiência mais segura, simples e completa para si.
          </p>

          <p
            style={{
              maxWidth: 520,
              margin: "14px 0 0",
              color: "#374151",
              fontSize: 14,
              fontWeight: 600,
              lineHeight: 1.65,
            }}
          >
            Neste momento, o acesso está disponível apenas para pessoas
            autorizadas.
          </p>

          <a
            href="mailto:support@pokerw.co.mz"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 9,
              marginTop: 30,
              color: "#111827",
              fontSize: 14,
              fontWeight: 800,
              textDecoration: "none",
              borderBottom: "1px solid #111827",
              paddingBottom: 5,
            }}
          >
            Falar com a equipa
            <ArrowUpRight size={16} strokeWidth={2.4} />
          </a>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.65, delay: 0.12, ease: "easeOut" }}
          style={{
            width: "100%",
            maxWidth: 410,
            justifySelf: "end",
            background: "#fff",
            border: "1px solid #e5e7eb",
            boxShadow: "0 24px 70px rgba(17,24,39,0.09)",
            padding: "clamp(24px, 5vw, 38px)",
          }}
        >
          <div
            style={{
              width: 78,
              height: 78,
              display: "grid",
              placeItems: "center",
              background: "#f0efff",
              color: "#6c5ce7",
              marginBottom: 27,
            }}
          >
            <LockKeyhole size={34} strokeWidth={1.6} />
          </div>

          <div
            style={{
              color: "#9ca3af",
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              marginBottom: 9,
            }}
          >
            Estado da plataforma
          </div>
          <h2
            style={{
              margin: 0,
              color: "#111827",
              fontSize: 25,
              lineHeight: 1.2,
              fontWeight: 800,
              letterSpacing: "-0.04em",
            }}
          >
            Estamos a construir algo melhor.
          </h2>
          <p
            style={{
              margin: "13px 0 28px",
              color: "#6b7280",
              fontSize: 14,
              lineHeight: 1.65,
            }}
          >
            A nossa equipa está a trabalhar para tornar o Winmoz mais
            confiável e preparado para todos.
          </p>

          <div
            style={{
              height: 4,
              background: "#edeef2",
              overflow: "hidden",
              marginBottom: 28,
            }}
          >
            <motion.div
              aria-hidden="true"
              animate={{ x: ["-100%", "230%"] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
              style={{
                width: "38%",
                height: "100%",
                background: "#6c5ce7",
              }}
            />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
            }}
          >
            {details.map(({ icon: Icon, label, value, tone }) => {
              const accent = tone === "green" ? "#059669" : "#6c5ce7";
              const background = tone === "green" ? "#ecfdf5" : "#f5f3ff";

              return (
                <div
                  key={label}
                  style={{
                    minWidth: 0,
                    background,
                    padding: "14px 12px",
                  }}
                >
                  <Icon size={17} color={accent} strokeWidth={2} />
                  <div
                    style={{
                      color: "#9ca3af",
                      fontSize: 10,
                      fontWeight: 800,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      marginTop: 11,
                    }}
                  >
                    {label}
                  </div>
                  <div
                    style={{
                      color: "#374151",
                      fontSize: 12,
                      fontWeight: 750,
                      lineHeight: 1.35,
                      marginTop: 4,
                    }}
                  >
                    {value}
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      </section>

      <footer
        style={{
          width: "100%",
          maxWidth: 1120,
          margin: "0 auto",
          padding: "20px clamp(20px, 5vw, 56px) 28px",
          color: "#9ca3af",
          fontSize: 11,
          position: "relative",
          zIndex: 1,
        }}
      >
        © 2026 Winmoz · Todos os direitos reservados
      </footer>

      <style>{`
        @media (max-width: 760px) {
          header {
            padding-top: 20px !important;
            padding-bottom: 20px !important;
          }
          header > div:last-child {
            font-size: 9px !important;
            padding: 7px 9px !important;
          }
          section {
            grid-template-columns: 1fr !important;
            padding-top: 52px !important;
            padding-bottom: 40px !important;
            margin: 0 !important;
          }
          section > div:last-child {
            max-width: none !important;
            justify-self: stretch !important;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          * {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>
    </main>
  );
}