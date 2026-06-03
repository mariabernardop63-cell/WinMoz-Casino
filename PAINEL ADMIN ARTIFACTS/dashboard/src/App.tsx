import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ThemeProvider } from "@/contexts/ThemeContext";

import Layout from "@/components/layout/Layout";
import Dashboard from "@/pages/dashboard";
import Matches from "@/pages/matches";
import MatchDetail from "@/pages/matches/detail";
import Players from "@/pages/players";
import PlayerDetail from "@/pages/players/detail";
import Bets from "@/pages/bets";
import Ranking from "@/pages/ranking";
import Reports from "@/pages/reports";
import Withdrawals from "@/pages/withdrawals";
import AntiFraud from "@/pages/antifraud";
import Settings from "@/pages/settings";
import AdminProfile from "@/pages/admin-profile";
import OnlineUsers from "@/pages/online-users";
import Balance from "@/pages/balance";
import ActivityLogs from "@/pages/activity-logs";

const queryClient = new QueryClient();

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/matches" component={Matches} />
        <Route path="/matches/:id" component={MatchDetail} />
        <Route path="/players" component={Players} />
        <Route path="/players/:id" component={PlayerDetail} />
        <Route path="/bets" component={Bets} />
        <Route path="/ranking" component={Ranking} />
        <Route path="/reports" component={Reports} />
        <Route path="/withdrawals" component={Withdrawals} />
        <Route path="/antifraud" component={AntiFraud} />
        <Route path="/settings" component={Settings} />
        <Route path="/admin/profile" component={AdminProfile} />
        <Route path="/online-users" component={OnlineUsers} />
        <Route path="/balance" component={Balance} />
        <Route path="/activity-logs" component={ActivityLogs} />
        <Route path="/relatorios" component={Reports} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
