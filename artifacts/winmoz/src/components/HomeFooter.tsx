import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { adminSupabase } from "@/admin/lib/supabase-api";
import { Smartphone, Mail, Phone, MapPin, ExternalLink } from "lucide-react";

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

export default function HomeFooter() {
  const [, navigate] = useLocation();
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
      background: "linear-gradient(180deg, #0a0a14 0%, #080810 100%)",
      borderTop: "1px solid rgba(124,58,237,0.15)",
      padding: "28px 20px 20px",
    }}>
      <div style={{ maxWidth: 430, margin: "0 auto" }}>

        {/* Brand */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="white" fillOpacity="0.95" />
              </svg>
            </div>
            <span style={{
              fontFamily: "'Syne', sans-serif", fontWeight: 900, fontSize: 16,
              background: "linear-gradient(135deg, #fff, #a78bfa)", WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}>
              MOZBET
            </span>
          </div>
          {s.footer_tagline && (
            <p style={{ fontSize: 11.5, color: "#52525b", lineHeight: 1.5 }}>
              {s.footer_tagline}
            </p>
          )}
        </div>

        {/* Quick links */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 20px", marginBottom: 16 }}>
          {LINKS.map(l => (
            <button
              key={l.href}
              onClick={() => navigate(l.href)}
              style={{
                background: "none", border: "none", cursor: "pointer",
                fontSize: 12, color: "#71717a", padding: 0,
                fontFamily: "inherit",
              }}
            >
              {l.label}
            </button>
          ))}
        </div>

        {/* Contact info */}
        {(s.footer_phone || s.footer_email) && (
          <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 16 }}>
            {s.footer_phone && (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Phone style={{ width: 11, height: 11, color: "#52525b" }} />
                <span style={{ fontSize: 11.5, color: "#52525b" }}>{s.footer_phone}</span>
              </div>
            )}
            {s.footer_email && (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Mail style={{ width: 11, height: 11, color: "#52525b" }} />
                <span style={{ fontSize: 11.5, color: "#52525b" }}>{s.footer_email}</span>
              </div>
            )}
          </div>
        )}

        {/* App download button */}
        {s.footer_app_download_url && (
          <a
            href={s.footer_app_download_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex", alignItems: "center", gap: 7,
              padding: "9px 16px", borderRadius: 10, marginBottom: 16,
              background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
              color: "#fff", textDecoration: "none",
              fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 12,
              boxShadow: "0 4px 14px rgba(124,58,237,0.35)",
            }}
          >
            <Smartphone style={{ width: 14, height: 14 }} />
            Descarregar App
            <ExternalLink style={{ width: 11, height: 11, opacity: 0.7 }} />
          </a>
        )}

        {/* Divider + copyright */}
        <div style={{ borderTop: "1px solid #1c1c2e", paddingTop: 12 }}>
          <p style={{ fontSize: 10.5, color: "#3f3f46", textAlign: "center" }}>
            © {new Date().getFullYear()} MOZBET. Todos os direitos reservados. +18 · Jogo responsável.
          </p>
        </div>
      </div>
    </footer>
  );
}
