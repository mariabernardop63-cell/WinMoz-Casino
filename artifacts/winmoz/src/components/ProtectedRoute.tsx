import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { ShieldOff } from "lucide-react";

interface Props {
  children: React.ReactNode;
}

function BlockedScreen() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ background: "linear-gradient(160deg, #1a0840 0%, #2d1065 50%, #1e0a3c 100%)" }}
    >
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: 22,
          background: "rgba(239,68,68,0.15)",
          border: "1.5px solid rgba(239,68,68,0.35)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 24,
        }}
      >
        <ShieldOff style={{ width: 32, height: 32, color: "#ef4444" }} />
      </div>
      <p
        style={{
          fontFamily: "'Syne', sans-serif",
          fontWeight: 800,
          fontSize: 22,
          color: "#fff",
          textAlign: "center",
          marginBottom: 12,
          lineHeight: 1.2,
        }}
      >
        Conta Bloqueada
      </p>
      <p
        style={{
          fontSize: 14,
          color: "rgba(255,255,255,0.6)",
          textAlign: "center",
          lineHeight: 1.6,
          maxWidth: 300,
          marginBottom: 32,
        }}
      >
        A tua conta foi suspensa pelo administrador da plataforma. Para mais informações contacta o suporte.
      </p>
      <a
        href="/suporte"
        style={{
          padding: "12px 28px",
          borderRadius: 14,
          background: "linear-gradient(135deg, #6C5CE7, #4f46e5)",
          color: "#fff",
          fontSize: 14,
          fontWeight: 700,
          textDecoration: "none",
          letterSpacing: "0.2px",
        }}
      >
        Contactar Suporte
      </a>
    </div>
  );
}

export default function ProtectedRoute({ children }: Props) {
  const { user, loading, isBlocked } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && !user && !isBlocked) {
      setLocation("/login");
    }
  }, [user, loading, isBlocked, setLocation]);

  if (loading) {
    // Auth can rehydrate after the current route has already mounted. Render
    // a light, bounded loading surface instead of exposing the dark body.
    return (
      <div
        role="status"
        aria-label="A carregar"
        style={{
          minHeight: "100vh",
          width: "100%",
          background: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 24,
            height: 24,
            border: "2px solid #e5e7eb",
            borderTopColor: "#111",
            borderRadius: "50%",
            animation: "wm-auth-spin 0.7s linear infinite",
          }}
        />
        <style>{`@keyframes wm-auth-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (isBlocked) return <BlockedScreen />;

  if (!user) return null;

  return <>{children}</>;
}
