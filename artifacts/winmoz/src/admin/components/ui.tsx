import React from "react";
import { RefreshCw } from "lucide-react";
import { motion } from "framer-motion";

/* ══════════════════════════════════════════════════════════════
   Shared admin UI primitives — consistent across all admin pages.
   Everything uses --gz-* tokens so light/dark mode just works.
══════════════════════════════════════════════════════════════ */

/* ── Rolling odometer digit ──
   Each digit is a vertical strip 0–9; only the digits that actually
   change roll. Digits that stay the same never move, so 200 → 201
   keeps "20" still and just rolls the last "1" into place. Long
   jumps (100 → 120) sweep quickly through every intermediate value. */
function RollingDigit({ digit }: { digit: number }) {
  return (
    <span
      className="inline-block overflow-hidden"
      style={{ height: "1em", width: "0.6em", lineHeight: 1, verticalAlign: "baseline" }}
    >
      <motion.span
        className="flex flex-col items-center"
        initial={false}
        animate={{ y: `${-digit * 10}%` }}
        transition={{ type: "spring", stiffness: 260, damping: 30, mass: 0.6, restDelta: 0.001 }}
        style={{ height: "10em", willChange: "transform" }}
      >
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} style={{ height: "1em", lineHeight: 1 }}>{i}</span>
        ))}
      </motion.span>
    </span>
  );
}

export function RollingNumber({
  value, decimals = 0, prefix, suffix, className = "", style,
}: {
  value: number; decimals?: number; prefix?: string; suffix?: string;
  className?: string; style?: React.CSSProperties;
}) {
  const safe = Number.isFinite(value) ? value : 0;
  const formatted = safe.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  const chars = formatted.split("");
  const len = chars.length;
  return (
    <span className={`inline-flex items-baseline tabular-nums ${className}`} style={style}>
      {prefix && <span style={{ marginRight: "0.26em" }}>{prefix}</span>}
      {chars.map((ch, i) => {
        const key = `k${len - 1 - i}`;
        if (ch >= "0" && ch <= "9") return <RollingDigit key={key} digit={Number(ch)} />;
        return (
          <span key={key} style={{ display: "inline-block", minWidth: "0.3em", textAlign: "center" }}>
            {ch}
          </span>
        );
      })}
      {suffix && <span style={{ marginLeft: "0.26em" }}>{suffix}</span>}
    </span>
  );
}

export function SectionHeader({
  icon: Icon, title, subtitle, action,
}: {
  icon?: React.ElementType; title: string; subtitle?: string; action?: React.ReactNode;
}) {
  return (
    <div
      className="flex items-center justify-between gap-3 px-5 py-3.5"
      style={{ borderBottom: "1px solid var(--gz-border-subtle)" }}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {Icon && (
          <div style={{
            width: 28, height: 28, borderRadius: 9, flexShrink: 0,
            background: "var(--gz-bg-subtle)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Icon style={{ width: 14, height: 14, color: "var(--gz-text-secondary)", strokeWidth: 1.9 }} />
          </div>
        )}
        <div className="min-w-0">
          <div className="text-[13.5px] font-bold leading-tight" style={{ color: "var(--gz-text-primary)" }}>{title}</div>
          {subtitle && (
            <div className="text-[11px] font-medium mt-0.5 truncate" style={{ color: "var(--gz-text-muted)" }}>{subtitle}</div>
          )}
        </div>
      </div>
      {action}
    </div>
  );
}

export function PageHeader({
  icon: Icon, titleAccent, title, subtitle, children,
}: {
  icon?: React.ElementType; title: string; titleAccent?: string; subtitle?: string; children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
      <div>
        <h1 className="text-[26px] font-black tracking-[-0.035em] leading-tight flex items-center gap-2.5" style={{ color: "var(--gz-text-primary)" }}>
          {Icon && <Icon style={{ width: 22, height: 22, strokeWidth: 2 }} />}
          {title}{titleAccent && <> <span className="gz-gradient-text">{titleAccent}</span></>}
        </h1>
        {subtitle && (
          <p className="mt-1 text-[12.5px] font-medium" style={{ color: "var(--gz-text-muted)" }}>{subtitle}</p>
        )}
      </div>
      {children}
    </div>
  );
}

export function KpiTile({
  label, value, icon: Icon, accent, hint, badge,
}: {
  label: string; value: React.ReactNode; icon: React.ElementType;
  accent?: string; hint?: string; badge?: React.ReactNode;
}) {
  return (
    <div className="px-5 py-4" style={{ background: "var(--gz-bg-card-btn)" }}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div style={{
            width: 30, height: 30, borderRadius: 10, flexShrink: 0,
            background: accent ? `${accent}16` : "var(--gz-bg-subtle)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Icon style={{ width: 15, height: 15, color: accent ?? "var(--gz-text-secondary)", strokeWidth: 1.9 }} />
          </div>
          <span className="text-[10.5px] font-bold uppercase tracking-[0.07em] truncate" style={{ color: "var(--gz-text-muted)" }}>
            {label}
          </span>
        </div>
        {badge}
      </div>
      <div className="text-[22px] font-black tracking-[-0.03em] tabular-nums truncate" style={{ color: "var(--gz-text-primary)" }}>
        {value}
      </div>
      {hint && <div className="text-[11px] font-medium mt-1 truncate" style={{ color: "var(--gz-text-muted)" }}>{hint}</div>}
    </div>
  );
}

export function KpiGrid({ children, cols = 3 }: { children: React.ReactNode; cols?: 2 | 3 | 4 }) {
  const mdCols = cols === 4 ? "md:grid-cols-4" : cols === 2 ? "md:grid-cols-2" : "md:grid-cols-3";
  return (
    <div className={`grid grid-cols-2 ${mdCols} gap-px`} style={{ background: "var(--gz-border-subtle)" }}>
      {children}
    </div>
  );
}

export function Card({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <section className={`gz-card overflow-hidden animate-float-up ${className}`} style={{ animationDelay: `${delay}ms` }}>
      {children}
    </section>
  );
}

export function ToolbarButton({
  icon: Icon, label, onClick, disabled, active, accent = "#18181b",
}: {
  icon?: React.ElementType; label?: string; onClick?: () => void;
  disabled?: boolean; active?: boolean; accent?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-2 h-9 px-3.5 rounded-xl text-[12.5px] font-bold transition-all active:scale-95 disabled:opacity-50 whitespace-nowrap"
      style={{
        background: active ? accent : "var(--gz-bg-card-btn)",
        border: `1px solid ${active ? accent : "var(--gz-border-subtle)"}`,
        color: active ? "#fff" : "var(--gz-text-secondary)",
      }}
    >
      {Icon && <Icon style={{ width: 14, height: 14 }} />}
      {label && <span>{label}</span>}
    </button>
  );
}

export function RefreshButton({ onClick, loading, label = "Actualizar" }: { onClick: () => void; loading?: boolean; label?: string }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="flex items-center gap-2 h-9 px-3.5 rounded-xl text-[12.5px] font-bold transition-all active:scale-95 disabled:opacity-60"
      style={{ background: "var(--gz-bg-card-btn)", border: "1px solid var(--gz-border-subtle)", color: "var(--gz-text-secondary)" }}
    >
      <RefreshCw style={{ width: 14, height: 14, animation: loading ? "spin 1s linear infinite" : undefined }} />
      {label}
    </button>
  );
}

export function StatusPill({ label, color, bg }: { label: string; color: string; bg?: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{
        background: bg ?? `${color}16`,
        color,
        border: `1px solid ${color}33`,
      }}
    >
      {label}
    </span>
  );
}

export function EmptyState({
  icon: Icon, title, subtitle,
}: {
  icon: React.ElementType; title: string; subtitle?: string;
}) {
  return (
    <div className="py-14 text-center">
      <div style={{
        width: 52, height: 52, borderRadius: 18, margin: "0 auto 12px",
        background: "var(--gz-bg-subtle)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Icon style={{ width: 24, height: 24, color: "var(--gz-text-tertiary)", strokeWidth: 1.5 }} />
      </div>
      <p className="text-[14px] font-bold" style={{ color: "var(--gz-text-primary)" }}>{title}</p>
      {subtitle && <p className="text-[12px] mt-1" style={{ color: "var(--gz-text-muted)" }}>{subtitle}</p>}
    </div>
  );
}

export function Modal({
  open, onClose, title, icon: Icon, children, maxWidth = 420,
}: {
  open: boolean; onClose: () => void; title: string; icon?: React.ElementType;
  children: React.ReactNode; maxWidth?: number;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,.5)" }} onClick={onClose}>
      <div
        className="gz-card w-full overflow-hidden animate-float-up"
        style={{ maxWidth, background: "var(--gz-bg-card)" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: "1px solid var(--gz-border-subtle)" }}>
          {Icon && (
            <div style={{ width: 34, height: 34, borderRadius: 11, background: "var(--gz-bg-subtle)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon style={{ width: 16, height: 16, color: "var(--gz-text-secondary)" }} />
            </div>
          )}
          <span className="text-[14.5px] font-bold" style={{ color: "var(--gz-text-primary)" }}>{title}</span>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function DataTable({ children, minWidth = 700 }: { children: React.ReactNode; minWidth?: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full" style={{ minWidth }}>
        {children}
      </table>
    </div>
  );
}

export function Th({ children, align = "left" }: { children?: React.ReactNode; align?: "left" | "right" | "center" }) {
  return (
    <th
      className={`px-5 py-2.5 text-[10.5px] font-bold uppercase tracking-[0.06em] ${align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"}`}
      style={{ color: "var(--gz-text-muted)", background: "var(--gz-bg-subtle)" }}
    >
      {children}
    </th>
  );
}
