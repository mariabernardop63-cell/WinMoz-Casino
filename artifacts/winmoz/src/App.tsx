import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import NotFound from "@/pages/not-found";
import AdminApp from "@/admin/AdminApp";
import Home from "@/pages/Home";
import Explorar from "@/pages/Explorar";
import Login from "@/pages/Login";
import Registar from "@/pages/Registar";
import EsqueceuSenha from "@/pages/EsqueceuSenha";
import RedefinirSenha from "@/pages/RedefinirSenha";
import OTP from "@/pages/OTP";
import SplashScreen from "@/pages/SplashScreen";
import Perfil from "@/pages/Perfil";
import Recarga from "@/pages/Recarga";
import Levantar from "@/pages/Levantar";
import Depositar from "@/pages/Depositar";
import EditarPerfil from "@/pages/EditarPerfil";
import ConvidarAmigos from "@/pages/ConvidarAmigos";
import Extratos from "@/pages/Extratos";
import Reportar from "@/pages/Reportar";
import Privacidade from "@/pages/Privacidade";
import PoliticaPrivacidade from "@/pages/PoliticaPrivacidade";
import Definicoes from "@/pages/Definicoes";
import Suporte from "@/pages/Suporte";
import Notificacoes from "@/pages/Notificacoes";
import GrupoChat from "@/pages/GrupoChat";
import ScannerQR from "@/pages/ScannerQR";
import Apostar from "@/pages/Apostar";
import ProgramaAfiliados from "@/pages/ProgramaAfiliados";
import LudoGame from "@/pages/LudoGame";
import ChessGame from "@/pages/ChessGame";
import DamasGame from "@/pages/DamasGame";
import Roleta from "@/pages/Roleta";
import BilharEmBreve from "@/pages/BilharEmBreve";
import NotificationBanner from "@/components/NotificationBanner";
import MaintenancePage from "@/components/MaintenancePage";
import CookieConsent from "@/components/CookieConsent";
import { useState, useEffect } from "react";
import { adminSupabase } from "@/admin/lib/supabase-api";
import { BrandProvider } from "@/lib/brand-context";
import { AppSettingsProvider } from "@/contexts/AppSettingsContext";
import TermosServico from "@/pages/TermosServico";

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

  // Still checking
  if (!checked) return null;

  if (maintenance) {
    return <MaintenancePage />;
  }

  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      {/* Public routes */}
      <Route path="/" component={Home} />
      <Route path="/explorar" component={Explorar} />
      <Route path="/login" component={Login} />
      <Route path="/registar" component={Registar} />
      <Route path="/esqueceu-senha" component={EsqueceuSenha} />
      <Route path="/redefinir-senha" component={RedefinirSenha} />
      <Route path="/otp" component={OTP} />
      <Route path="/splash" component={SplashScreen} />

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

function App() {
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
