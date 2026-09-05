import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { lazy, Suspense, useState, useEffect } from "react";
import Home from "@/pages/Home";
import NotificationBanner from "@/components/NotificationBanner";
import MaintenancePage from "@/components/MaintenancePage";
import CookieConsent from "@/components/CookieConsent";
import { adminSupabase } from "@/admin/lib/supabase-api";
import { BrandProvider } from "@/lib/brand-context";
import { AppSettingsProvider } from "@/contexts/AppSettingsContext";

/* Route-level code splitting — heavy pages (games, admin, forms) load on demand.
   Os importers ficam num mapa para o pré-carregamento em idle (ver abaixo). */
const pageLoaders = {
  NotFound: () => import("@/pages/not-found"),
  Explorar: () => import("@/pages/Explorar"),
  Login: () => import("@/pages/Login"),
  Registar: () => import("@/pages/Registar"),
  EsqueceuSenha: () => import("@/pages/EsqueceuSenha"),
  RedefinirSenha: () => import("@/pages/RedefinirSenha"),
  OTP: () => import("@/pages/OTP"),
  Perfil: () => import("@/pages/Perfil"),
  Recarga: () => import("@/pages/Recarga"),
  Levantar: () => import("@/pages/Levantar"),
  Depositar: () => import("@/pages/Depositar"),
  EditarPerfil: () => import("@/pages/EditarPerfil"),
  ConvidarAmigos: () => import("@/pages/ConvidarAmigos"),
  Extratos: () => import("@/pages/Extratos"),
  Reportar: () => import("@/pages/Reportar"),
  Privacidade: () => import("@/pages/Privacidade"),
  PoliticaPrivacidade: () => import("@/pages/PoliticaPrivacidade"),
  Definicoes: () => import("@/pages/Definicoes"),
  Suporte: () => import("@/pages/Suporte"),
  Notificacoes: () => import("@/pages/Notificacoes"),
  GrupoChat: () => import("@/pages/GrupoChat"),
  ScannerQR: () => import("@/pages/ScannerQR"),
  Apostar: () => import("@/pages/Apostar"),
  ProgramaAfiliados: () => import("@/pages/ProgramaAfiliados"),
  LudoGame: () => import("@/pages/LudoGame"),
  ChessGame: () => import("@/pages/ChessGame"),
  DamasGame: () => import("@/pages/DamasGame"),
  Roleta: () => import("@/pages/Roleta"),
  BilharEmBreve: () => import("@/pages/BilharEmBreve"),
  TermosServico: () => import("@/pages/TermosServico"),
};

const NotFound = lazy(pageLoaders.NotFound);
const AdminApp = lazy(() => import("@/admin/AdminApp"));
const Explorar = lazy(pageLoaders.Explorar);
const Login = lazy(pageLoaders.Login);
const Registar = lazy(pageLoaders.Registar);
const EsqueceuSenha = lazy(pageLoaders.EsqueceuSenha);
const RedefinirSenha = lazy(pageLoaders.RedefinirSenha);
const OTP = lazy(pageLoaders.OTP);
const Perfil = lazy(pageLoaders.Perfil);
const Recarga = lazy(pageLoaders.Recarga);
const Levantar = lazy(pageLoaders.Levantar);
const Depositar = lazy(pageLoaders.Depositar);
const EditarPerfil = lazy(pageLoaders.EditarPerfil);
const ConvidarAmigos = lazy(pageLoaders.ConvidarAmigos);
const Extratos = lazy(pageLoaders.Extratos);
const Reportar = lazy(pageLoaders.Reportar);
const Privacidade = lazy(pageLoaders.Privacidade);
const PoliticaPrivacidade = lazy(pageLoaders.PoliticaPrivacidade);
const Definicoes = lazy(pageLoaders.Definicoes);
const Suporte = lazy(pageLoaders.Suporte);
const Notificacoes = lazy(pageLoaders.Notificacoes);
const GrupoChat = lazy(pageLoaders.GrupoChat);
const ScannerQR = lazy(pageLoaders.ScannerQR);
const Apostar = lazy(pageLoaders.Apostar);
const ProgramaAfiliados = lazy(pageLoaders.ProgramaAfiliados);
const LudoGame = lazy(pageLoaders.LudoGame);
const ChessGame = lazy(pageLoaders.ChessGame);
const DamasGame = lazy(pageLoaders.DamasGame);
const Roleta = lazy(pageLoaders.Roleta);
const BilharEmBreve = lazy(pageLoaders.BilharEmBreve);
const TermosServico = lazy(pageLoaders.TermosServico);

/* Pré-carrega os chunks: rotas de autenticação imediatamente (a primeira
   navegação nunca mostra spinner), o resto quando o browser está idle —
   incluindo o painel admin, para o login de admin não "ficar a processar". */
function preloadPages() {
  [
    pageLoaders.Login, pageLoaders.Registar, pageLoaders.OTP,
    pageLoaders.EsqueceuSenha, pageLoaders.RedefinirSenha,
    pageLoaders.Explorar,
  ].forEach(loader => { loader().catch(() => {}); });

  const rest = () => {
    Object.values(pageLoaders)
      .filter(l => ![
        pageLoaders.Login, pageLoaders.Registar, pageLoaders.OTP,
        pageLoaders.EsqueceuSenha, pageLoaders.RedefinirSenha,
        pageLoaders.Explorar,
      ].includes(l))
      .forEach(loader => { loader().catch(() => {}); });
    import("@/admin/AdminApp").catch(() => {});
  };
  (window as any).requestIdleCallback
    ? (window as any).requestIdleCallback(rest, { timeout: 6000 })
    : setTimeout(rest, 2000);
}

function PageFallback() {
  // Never leave the browser's dark body exposed while a route chunk loads.
  // The previous route may already have been removed by Suspense at this point.
  return (
    <div
      role="status"
      aria-label="A carregar"
      style={{
        minHeight: "100vh",
        width: "100%",
        background: "#fff",
        color: "#111",
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
          animation: "wm-route-spin 0.7s linear infinite",
        }}
      />
      <style>{`@keyframes wm-route-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const queryClient = new QueryClient();

/* ── Maintenance gate — wraps only user-facing routes ── */
function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [location] = useLocation();
  const [maintenance, setMaintenance] = useState(false);
  const [checked, setChecked] = useState(false);

  // Admin panel always bypasses maintenance — check route first
  const isAdminRoute = location.startsWith("/admin");

  useEffect(() => {
    if (isAdminRoute) return;

    // Ler via API server-side (usa service role — nunca bloqueado por RLS)
    const fetchMaintenance = () => {
      fetch("/api/admin/settings?key=maintenance_mode")
        .then(r => r.json())
        .then((d: { setting?: { value: string } | null }) => {
          setMaintenance(d?.setting?.value === "true");
          setChecked(true);
        })
        .catch(() => setChecked(true));
    };

    fetchMaintenance();

    // Polling a cada 30 segundos para apanhar mudanças em tempo real
    // (substitui Realtime que falha com anon key quando RLS está ativo)
    const interval = setInterval(fetchMaintenance, 30_000);

    // Realtime como bonus — se RLS permitir, recebe mudanças imediatamente
    const channel = adminSupabase
      .channel("maintenance-watch-v3")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "platform_settings", filter: "key=eq.maintenance_mode" },
        () => {
          // Quando o Realtime dispara, faz fetch via API (não confia no payload que pode ter RLS)
          fetchMaintenance();
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      adminSupabase.removeChannel(channel);
    };
  }, [isAdminRoute]);

  // Admin routes always pass through
  if (isAdminRoute) return <>{children}</>;

  // Still checking: keep a real surface visible instead of exposing the
  // browser/body background during the first request.
  if (!checked) return <PageFallback />;

  if (maintenance) {
    return <MaintenancePage />;
  }

  return <>{children}</>;
}

function Router() {
  return (
    <Suspense fallback={<PageFallback />}>
    <Switch>
      {/* Public routes */}
      <Route path="/" component={Home} />
      <Route path="/explorar" component={Explorar} />
      <Route path="/login" component={Login} />
      <Route path="/registar" component={Registar} />
      <Route path="/esqueceu-senha" component={EsqueceuSenha} />
      <Route path="/redefinir-senha" component={RedefinirSenha} />
      <Route path="/otp" component={OTP} />

      {/* Protected routes — require login */}
      <Route path="/perfil">
        <ProtectedRoute><Perfil /></ProtectedRoute>
      </Route>
      <Route path="/notificacoes">
        <ProtectedRoute><Notificacoes /></ProtectedRoute>
      </Route>
      <Route path="/grupo-chat">
        <ProtectedRoute><GrupoChat /></ProtectedRoute>
      </Route>
      <Route path="/apostar/:gameId">
        {() => (
          <ProtectedRoute><Apostar /></ProtectedRoute>
        )}
      </Route>
      <Route path="/editar-perfil">
        <ProtectedRoute><EditarPerfil /></ProtectedRoute>
      </Route>
      <Route path="/recarga">
        <ProtectedRoute><Recarga /></ProtectedRoute>
      </Route>
      <Route path="/levantar">
        <ProtectedRoute><Levantar /></ProtectedRoute>
      </Route>
      <Route path="/depositar">
        <ProtectedRoute><Depositar /></ProtectedRoute>
      </Route>
      <Route path="/convidar-amigos">
        <ProtectedRoute><ConvidarAmigos /></ProtectedRoute>
      </Route>
      <Route path="/extratos">
        <ProtectedRoute><Extratos /></ProtectedRoute>
      </Route>
      <Route path="/reportar">
        <ProtectedRoute><Reportar /></ProtectedRoute>
      </Route>
      <Route path="/privacidade">
        <ProtectedRoute><Privacidade /></ProtectedRoute>
      </Route>
      <Route path="/politica-privacidade">
        <ProtectedRoute><PoliticaPrivacidade /></ProtectedRoute>
      </Route>
      <Route path="/termos">
        <ProtectedRoute><TermosServico /></ProtectedRoute>
      </Route>
      <Route path="/definicoes">
        <ProtectedRoute><Definicoes /></ProtectedRoute>
      </Route>
      <Route path="/suporte">
        <ProtectedRoute><Suporte /></ProtectedRoute>
      </Route>
      <Route path="/scanner-qr">
        <ProtectedRoute><ScannerQR /></ProtectedRoute>
      </Route>
      <Route path="/ludo-jogo">
        <ProtectedRoute><LudoGame /></ProtectedRoute>
      </Route>
      <Route path="/xadrez-jogo">
        <ProtectedRoute><ChessGame /></ProtectedRoute>
      </Route>
      <Route path="/damas-jogo">
        <ProtectedRoute><DamasGame /></ProtectedRoute>
      </Route>
      <Route path="/roleta">
        <ProtectedRoute><Roleta /></ProtectedRoute>
      </Route>
      <Route path="/bilhar-em-breve" component={BilharEmBreve} />
      <Route path="/afiliados">
        <ProtectedRoute><ProgramaAfiliados /></ProtectedRoute>
      </Route>

      {/* Admin panel — accessible at /admin and all sub-paths */}
      <Route path="/admin" component={AdminApp} />
      <Route path="/admin/:rest*" component={AdminApp} />

      {/* Invite link redirect — catches /:code AFTER all named routes */}
      <Route path="/:code">
        {(params) => {
          const code = (params.code ?? "").toUpperCase();
          if (/^[A-Z0-9]{4,8}$/.test(code)) {
            try { sessionStorage.setItem("pendingInviteCode", code); } catch { /* ignore */ }
            window.location.replace(`/registar?ref=${code}`);
            return null;
          }
          return <NotFound />;
        }}
      </Route>

      <Route component={NotFound} />
    </Switch>
    </Suspense>
  );
}

function AppContent() {
  return (
    <MaintenanceGate>
      <Router />
      <NotificationBanner />
      <CookieConsent />
    </MaintenanceGate>
  );
}

/* Pré-carrega as páginas uma única vez, logo após o primeiro render */
function App() {
  useEffect(() => { preloadPages(); }, []);
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <BrandProvider>
            <AppSettingsProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <AppContent />
            </WouterRouter>
            </AppSettingsProvider>
            <Toaster />
          </BrandProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
