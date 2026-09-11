import { useBrand } from "@/lib/brand-context";

interface BrandLogoProps {
  /** Altura do símbolo em px (o texto escala em proporção). */
  height?: number;
  /** "dark" = tinta escura (fundos claros) · "light" = tinta branca (fundos escuros). */
  variant?: "dark" | "light";
  /** Mostra o subtítulo (ex.: "Winner Online"). */
  showSubtitle?: boolean;
  className?: string;
}

/**
 * Logótipo oficial Poker Winner.
 * Símbolo "W" (imagem em /public) + nome da marca dinâmico do BrandContext,
 * para que o modo Poker Winner / Mozbet continue a funcionar.
 */
export default function BrandLogo({
  height = 36,
  variant = "dark",
  showSubtitle = true,
  className = "",
}: BrandLogoProps) {
  const { brandName, brandSubtitle } = useBrand();
  const ink = variant === "light" ? "#FFFFFF" : "#0D0D0D";
  const symbolSrc = variant === "light" ? "/pokerwinner-logo-white.png" : "/pokerwinner-logo.png";

  const nameSize = Math.round(height * 0.62);
  const subSize = Math.round(height * 0.3);

  return (
    <div className={`flex items-center gap-[0.45em] ${className}`} style={{ fontSize: height }}>
      <img
        src={symbolSrc}
        alt={brandName}
        style={{
          height: `${height * 0.94}px`,
          width: "auto",
          display: "block",
          flexShrink: 0,
          objectFit: "contain",
          filter: variant === "light" ? "drop-shadow(0 1px 2px rgba(0,0,0,.35))" : "none",
        }}
        draggable={false}
      />
      <div className="flex flex-col justify-center leading-none" style={{ minWidth: 0 }}>
        <span
          style={{
            fontFamily: "'Syne', sans-serif",
            fontWeight: 800,
            fontSize: `${nameSize}px`,
            letterSpacing: "0.02em",
            color: ink,
            whiteSpace: "nowrap",
          }}
        >
          {brandName}
        </span>
        {showSubtitle && (
          <span
            style={{
              fontFamily: "'Syne', sans-serif",
              fontWeight: 300,
              fontSize: `${subSize}px`,
              letterSpacing: "0.28em",
              color: ink,
              whiteSpace: "nowrap",
              marginTop: `${Math.round(height * 0.08)}px`,
            }}
          >
            {brandSubtitle}
          </span>
        )}
      </div>
    </div>
  );
}

/** Apenas o símbolo "W" (sem texto), útil para ícones de avatar/chat. */
export function BrandMark({ size = 20, variant = "light" }: { size?: number; variant?: "dark" | "light" }) {
  const src = variant === "light" ? "/pokerwinner-logo-white.png" : "/pokerwinner-logo.png";
  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      style={{ width: `${size}px`, height: "auto", display: "block", objectFit: "contain" }}
      draggable={false}
    />
  );
}