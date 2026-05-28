import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";

type Phase = "init" | "draw" | "hold" | "erase" | "barsOut" | "spinner";

export default function SplashScreen() {
  const [, setLocation] = useLocation();
  const [phase, setPhase] = useState<Phase>("init");

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase("draw"),    800),
      setTimeout(() => setPhase("hold"),    2380),
      setTimeout(() => setPhase("erase"),   2780),
      setTimeout(() => setPhase("barsOut"), 4060),
      setTimeout(() => setPhase("spinner"), 4500),
      setTimeout(() => {
        localStorage.setItem("winmoz_logged_in", "1");
        setLocation("/");
      }, 6100),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  const showLogo   = phase !== "spinner";
  const showText   = phase === "draw" || phase === "hold" || phase === "erase";
  const showSpinner = phase === "spinner";

  /* ── text container width (the width-wipe drives the trim-path look) ── */
  const targetWidth = (phase === "draw" || phase === "hold") ? 157 : 0;
  const widthTransition: Parameters<typeof motion.div>[0]["transition"] =
    phase === "draw"
      ? { duration: 1.38, ease: "linear" }
      : phase === "erase"
      ? { duration: 1.22, ease: "linear" }
      : phase === "hold"
      ? { duration: 0 }
      : { duration: 0.45, ease: [0.22, 1, 0.36, 1] };

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
        background: "#ffffff",
      }}
    >
      {/* Premium subtle vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 70% 55% at 50% 50%, #ffffff 0%, #f9f9f9 60%, #f0f0f0 100%)",
          pointerEvents: "none",
        }}
      />

      {/* ── LOGO SECTION ── */}
      <AnimatePresence mode="wait">
        {showLogo && (
          <motion.div
            key="logo"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.38 } }}
            transition={{ duration: 0.5 }}
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              width: "100%",
              zIndex: 1,
              position: "relative",
            }}
          >
            {/* inline-flex so flex centering shifts bars left as text grows */}
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>

              {/* ── BARS ── */}
              <motion.div
                initial={{ scaleY: 0.5, opacity: 0 }}
                animate={{ scaleY: 1, opacity: 1 }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                style={{ transformOrigin: "center" }}
              >
                <svg width="22" height="46" viewBox="0 0 22 46" fill="none">
                  <path d="M1 2 L11 2 L7 44 L0 44 Z" fill="#0D0D0D" />
                  <path d="M13 2 L20 2 L16 44 L10 44 Z" fill="#0D0D0D" opacity="0.18" />
                </svg>
              </motion.div>

              {/* ── TEXT (overflow:hidden wipe = trim-path effect) ── */}
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: targetWidth }}
                transition={widthTransition}
                style={{ overflow: "hidden", whiteSpace: "nowrap" }}
              >
                <span
                  style={{
                    fontFamily: "'Syne', sans-serif",
                    fontWeight: 800,
                    fontSize: 40,
                    letterSpacing: "-1.5px",
                    color: "#0D0D0D",
                    display: "inline-block",
                    lineHeight: "46px",
                    userSelect: "none",
                  }}
                >
                  Poker
                </span>
                {/* ® circle */}
                <svg
                  style={{
                    display: "inline-block",
                    verticalAlign: "top",
                    marginLeft: 3,
                    marginTop: 5,
                  }}
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                >
                  <circle cx="7" cy="7" r="6" stroke="#0D0D0D" strokeWidth="1.4" fill="none" />
                  <text
                    x="7"
                    y="11"
                    textAnchor="middle"
                    fontFamily="'Syne', sans-serif"
                    fontWeight="700"
                    fontSize="7"
                    fill="#0D0D0D"
                  >
                    R
                  </text>
                </svg>
              </motion.div>
            </div>
          </motion.div>
        )}

        {/* ── RED SPINNER ── */}
        {showSpinner && (
          <motion.div
            key="spinner"
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
            style={{ zIndex: 1, position: "relative" }}
          >
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: "50%",
                border: "3px solid #fecaca",
                borderTopColor: "#ef4444",
                animation: "winmoz-spin 0.75s linear infinite",
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @keyframes winmoz-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
