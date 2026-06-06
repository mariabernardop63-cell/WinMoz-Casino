import { Switch, Route, Router as WouterRouter } from "wouter";
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
import Definicoes from "@/pages/Definicoes";
import Suporte from "@/pages/Suporte";
import Notificacoes from "@/pages/Notificacoes";
import GrupoChat from "@/pages/GrupoChat";
import ScannerQR from "@/pages/ScannerQR";
import Apostar from "@/pages/Apostar";
import LudoGame from "@/pages/LudoGame";
import ChessGame from "@/pages/ChessGame";
import DamasGame from "@/pages/DamasGame";
import Roleta from "@/pages/Roleta";
import BilharEmBreve from "@/pages/BilharEmBreve";
import NotificationBanner from "@/components/NotificationBanner";
import MaintenancePage from "@/components/MaintenancePage";
import { useState, useEffect } from "react";
import { adminSupabase } from "@/admin/lib/supabase-api";
import { supabase } from "@/lib/supabase";

const queryClient = new QueryClient();

const ADMIN_EMAIL = "nexialonemz@gmail.com";

function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [maintenance, setMaintenance] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // Initial fetch
    adminSupabase
      .from("platform_settings")
      .select("value")
      .eq("key", "maintenance_mode")
      .single()
      .then(({ data }) => {
        setMaintenance((data as { value: string } | null)?.value === "true");
        setChecked(true);
      }, () => setChecked(true));

    // Realtime subscription
    const channel = supabase
      .channel("maintenance-mode-watch")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "platform_settings", filter: "key=eq.maintenance_mode" },
        (payload) => {
          const newVal = (payload.new as { value?: string } | undefined)?.value;
          setMaintenance(newVal === "true");
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // While checking, show nothing to avoid flash
  if (!checked) return null;

  // Admin bypass maintenance mode
  const isAdmin = user?.email === ADMIN_EMAIL;

  if (maintenance && !isAdmin) {
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

      {/* Admin panel — accessible at /admin and all sub-paths */}
      <Route path="/admin" component={AdminApp} />
      <Route path="/admin/:rest*" component={AdminApp} />

      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  return (
    <MaintenanceGate>
      <Router />
      <NotificationBanner />
    </MaintenanceGate>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <AppContent />
          </WouterRouter>
          <Toaster />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
