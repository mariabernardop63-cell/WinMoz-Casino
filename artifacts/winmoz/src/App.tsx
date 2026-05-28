import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import Explorar from "@/pages/Explorar";
import Login from "@/pages/Login";
import Registar from "@/pages/Registar";
import EsqueceuSenha from "@/pages/EsqueceuSenha";
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

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/explorar" component={Explorar} />
      <Route path="/login" component={Login} />
      <Route path="/registar" component={Registar} />
      <Route path="/esqueceu-senha" component={EsqueceuSenha} />
      <Route path="/otp" component={OTP} />
      <Route path="/splash" component={SplashScreen} />
      <Route path="/perfil" component={Perfil} />
      <Route path="/recarga" component={Recarga} />
      <Route path="/levantar" component={Levantar} />
      <Route path="/depositar" component={Depositar} />
      <Route path="/editar-perfil" component={EditarPerfil} />
      <Route path="/convidar-amigos" component={ConvidarAmigos} />
      <Route path="/extratos" component={Extratos} />
      <Route path="/reportar" component={Reportar} />
      <Route path="/privacidade" component={Privacidade} />
      <Route path="/definicoes" component={Definicoes} />
      <Route path="/suporte" component={Suporte} />
      <Route path="/notificacoes" component={Notificacoes} />
      <Route path="/grupo-chat" component={GrupoChat} />
      <Route path="/scanner-qr" component={ScannerQR} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
