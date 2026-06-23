import { useState, useEffect, useRef } from "react";

export default function AdBanner({ className, compact }: { className?: string; compact?: boolean }) {
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [showFallback, setShowFallback] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const height = compact ? 44 : 50;

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      if (!iframeLoaded) setShowFallback(true);
    }, 3500);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [iframeLoaded]);

  return (
    <div
      className={className}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: height,
        position: "relative",
      }}
    >
      {/* External ad iframe — hidden behind fallback until loaded */}
      <iframe
        src="/ad-banner.html"
        width={320}
        height={height}
        frameBorder={0}
        scrolling="no"
        style={{
          border: "none",
          display: "block",
          position: showFallback ? "absolute" : "relative",
          opacity: showFallback ? 0 : 1,
          pointerEvents: showFallback ? "none" : "auto",
          transition: "opacity 0.3s",
        }}
        title="Anúncio"
        onLoad={() => {
          if (timerRef.current) clearTimeout(timerRef.current);
          setIframeLoaded(true);
          setShowFallback(false);
        }}
        onError={() => setShowFallback(true)}
      />

      {/* VPN-proof fallback banner — always visible until real ad loads */}
      {showFallback && (
        <div
          style={{
            width: 320,
            height,
            background: "linear-gradient(90deg,#0d0d0d 0%,#1a0a2e 55%,#0d0d0d 100%)",
            border: "1px solid rgba(124,58,237,0.35)",
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            flexShrink: 0,
          }}
        >
          <span style={{
            width: 5, height: 5, borderRadius: "50%", background: "#7c3aed", flexShrink: 0,
            animation: "pulse-dot 1.8s ease-in-out infinite",
          }} />
          <span style={{
            background: "linear-gradient(135deg,#7c3aed,#5b21b6)",
            color: "#fff", fontSize: 9, fontWeight: 700, letterSpacing: 1,
            padding: "3px 8px", borderRadius: 99, textTransform: "uppercase", flexShrink: 0,
          }}>Anúncio</span>
          <span style={{
            fontSize: compact ? 10 : 11, color: "rgba(255,255,255,0.75)",
            fontWeight: 600, letterSpacing: 0.2,
          }}>Ganhe a qualquer hora — Saques 24h</span>
        </div>
      )}

      <style>{`@keyframes pulse-dot{0%,100%{opacity:.5;transform:scale(1)}50%{opacity:1;transform:scale(1.3)}}`}</style>
    </div>
  );
}
