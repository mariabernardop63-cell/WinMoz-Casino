import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { useBrand } from "@/lib/brand-context";

type Phase = "init" | "draw" | "hold" | "erase" | "barsOut" | "spinner";

export default function SplashScreen() {
  const [, setLocation] = useLocation();
  const [phase, setPhase] = useState<Phase>("init");
  const { brandName, brandSubtitle } = useBrand();

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase("draw"),    800),
      setTimeout(() => setPhase("hold"),    2380),
      setTimeout(() => setPhase("erase"),   2780),
      setTimeout(() => setPhase("barsOut"), 4060),
      setTimeout(() => setPhase("spinner"), 4500),
      setTimeout(() => { setLocation("/"); }, 6100),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  const showLogo    = phase !== "spinner";
  const showText    = phase === "draw" || phase === "hold" || phase === "erase";
  const showSpinner = phase === "spinner";

  // Width of the text column (enough for "MOZBET" at 22px bold ≈ 90px)
  const targetWidth = (phase === "draw" || phase === "hold") ? 98 : 0;
  const widthTransition: Parameters<typeof motion.div>[0]["transition"] =
    phase === "draw"
      ? { duration: 1.38, ease: "linear" }
      : phase === "erase"
      ? { duration: 1.22, ease: "linear" }
      : phase === "hold"
      ? { duration: 0 }
      : { duration: 0.45, ease: [0.22, 1, 0.36, 1] };

  return (
    <div style={{
      minHeight: "100vh", width: "100%",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      position: "relative", overflow: "hidden", background: "#ffffff",
    }}>
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(ellipse 70% 55% at 50% 50%, #ffffff 0%, #f9f9f9 60%, #f0f0f0 100%)",
        pointerEvents: "none",
      }} />

      <AnimatePresence mode="wait">
        {showLogo && (
          <motion.div key="logo"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.38 } }}
            transition={{ duration: 0.5 }}
            style={{ display: "flex", justifyContent: "center", alignItems: "center", width: "100%", zIndex: 1, position: "relative" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
              {/* Logo mark — vertical bars */}
              <motion.div initial={{ scaleY: 0.5, opacity: 0 }} animate={{ scaleY: 1, opacity: 1 }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }} style={{ transformOrigin: "center" }}>
                <svg width="22" height="46" viewBox="0 0 22 46" fill="none">
                  <path d="M1 2 L11 2 L7 44 L0 44 Z" fill="#0D0D0D" />
                  <path d="M13 2 L20 2 L16 44 L10 44 Z" fill="#0D0D0D" opacity="0.18" />
                </svg>
              </motion.div>

              {/* Animated text reveal — stacked MOZBET / MOZAMBIQUE */}
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: targetWidth }}
                transition={widthTransition}
                style={{ overflow: "hidden", height: 46, display: "flex", alignItems: "center" }}
              >
                <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 0, userSelect: "none", whiteSpace: "nowrap" }}>
                  <span style={{
                    fontFamily: "'Syne', sans-serif",
                    fontWeight: 800,
                    fontSize: 22,
                    letterSpacing: "-0.5px",
                    color: "#0D0D0D",
                    lineHeight: "26px",
                    display: "block",
                  }}>
                    {brandName}
                  </span>
                  <span style={{
                    fontFamily: "'Syne', sans-serif",
                    fontWeight: 300,
                    fontSize: 10,
                    letterSpacing: "2px",
                    color: "#0D0D0D",
                    lineHeight: "18px",
                    display: "block",
                  }}>
                    {brandSubtitle}
                  </span>
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}

        {showSpinner && (
          <motion.div key="spinner"
            initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
            style={{ zIndex: 1, position: "relative" }}>
            <div style={{
              width: 46, height: 46, borderRadius: "50%",
              border: "3px solid #fecaca", borderTopColor: "#ef4444",
              animation: "winmoz-spin 0.75s linear infinite",
            }} />
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`@keyframes winmoz-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
