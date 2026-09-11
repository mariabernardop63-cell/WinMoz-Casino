import { useEffect, useState } from "react";
import BrandLogo from "@/components/BrandLogo";
import { useLocation } from "wouter";
import { adminSupabase } from "@/admin/lib/supabase-api";
import { Smartphone, Mail, Phone, ExternalLink } from "lucide-react";
import { useBrand } from "@/lib/brand-context";

interface FooterSettings {
  footer_tagline: string;
  footer_phone: string;
  footer_email: string;
  footer_app_download_url: string;
}

const LINKS = [
  { label: "Jogos", href: "/apostar/damas" },
  { label: "Carteira", href: "/depositar" },
  { label: "Afiliados", href: "/afiliados" },
  { label: "Suporte", href: "/suporte" },
  { label: "Privacidade", href: "/privacidade" },
];

function MozBetLogo({ variant = "dark", height = 32 }: { variant?: "dark" | "light"; height?: number }) {
  return <BrandLogo variant={variant} height={height} />;
}

export default function HomeFooter() {
  const [, navigate] = useLocation();
  const { brandName } = useBrand();
  const [s, setS] = useState<FooterSettings>({
    footer_tagline: "Joga. Aposta. Vence.",
    footer_phone: "",
    footer_email: "",
    footer_app_download_url: "",
  });

  useEffect(() => {
    adminSupabase
      .from("platform_settings")
      .select("key, value")
      .in("key", ["footer_tagline", "footer_phone", "footer_email", "footer_app_download_url"])
      .then(({ data }) => {
        if (!data) return;
        const map: Record<string, string> = {};
        for (const row of data) map[row.key as string] = row.value as string;
        setS(prev => ({ ...prev, ...map }));
      });
  }, []);

  return (
    <footer style={{
      background: "#fff",
      borderTop: "1px solid #e5e7eb",
      padding: "28px 20px 24px",
    }}>
      <div style={{ maxWidth: 430, margin: "0 auto" }}>

        {/* Brand */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ marginBottom: 8 }}>
            <MozBetLogo />
          </div>
          {s.footer_tagline && (
            <p style={{ fontSize: 12.5, color: "#6b7280", lineHeight: 1.5, margin: 0 }}>
              {s.footer_tagline}
            </p>
          )}
        </div>

        {/* Quick links */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 20px", marginBottom: 18 }}>
          {LINKS.map(l => (
            <button
              key={l.href}
              onClick={() => navigate(l.href)}
              style={{
                background: "none", border: "none", cursor: "pointer",
                fontSize: 12.5, color: "#374151", padding: 0,
                fontFamily: "inherit", fontWeight: 500,
              }}
            >
              {l.label}
            </button>
          ))}
        </div>

        {/* Contact info */}
        {(s.footer_phone || s.footer_email) && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 18 }}>
            {s.footer_phone && (
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <Phone style={{ width: 12, height: 12, color: "#9ca3af" }} />
                <span style={{ fontSize: 12, color: "#6b7280" }}>{s.footer_phone}</span>
              </div>
            )}
            {s.footer_email && (
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <Mail style={{ width: 12, height: 12, color: "#9ca3af" }} />
                <span style={{ fontSize: 12, color: "#6b7280" }}>{s.footer_email}</span>
              </div>
            )}
          </div>
        )}

        {/* App download button */}
        {s.footer_app_download_url && (
          <a
            href={/^https?:\/\//i.test(s.footer_app_download_url) ? s.footer_app_download_url : `https://${s.footer_app_download_url}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex", alignItems: "center", gap: 7,
              padding: "9px 18px", borderRadius: 8, marginBottom: 18,
              background: "#0D0D0D",
              color: "#fff", textDecoration: "none",
              fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 12,
            }}
          >
            <Smartphone style={{ width: 13, height: 13 }} />
            Descarregar App
            <ExternalLink style={{ width: 11, height: 11, opacity: 0.6 }} />
          </a>
        )}

        {/* Divider + copyright */}
        <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: 14 }}>
          <p style={{ fontSize: 11, color: "#9ca3af", textAlign: "center", margin: 0 }}>
            © {new Date().getFullYear()} {brandName}. Todos os direitos reservados. +18 · Jogo responsável.
          </p>
        </div>
      </div>
    </footer>
  );
}
