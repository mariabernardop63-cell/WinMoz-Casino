import { Switch, Route, Router as WouterRouter } from "wouter";
import { ErrorBoundary } from "@/admin/components/ErrorBoundary";
import { AdminThemeProvider } from "@/admin/contexts/AdminThemeContext";
import AdminLayout from "@/admin/layout/Layout";
import Dashboard from "@/admin/pages/dashboard";
import Matches from "@/admin/pages/matches";
import MatchDetail from "@/admin/pages/matches/detail";
import Players from "@/admin/pages/players";
import PlayerDetail from "@/admin/pages/players/detail";
import Bets from "@/admin/pages/bets";
import Ranking from "@/admin/pages/ranking";
import Reports from "@/admin/pages/reports";
import Withdrawals from "@/admin/pages/withdrawals";
import AntiFraud from "@/admin/pages/antifraud";
import Settings from "@/admin/pages/settings";
import AdminProfile from "@/admin/pages/admin-profile";
import OnlineUsers from "@/admin/pages/online-users";
import Balance from "@/admin/pages/balance";
import ActivityLogs from "@/admin/pages/activity-logs";

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
const ADMIN_BASE = `${BASE}/admin`;

function AdminRouter() {
  return (
    <AdminLayout>
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
        <Route path="/profile" component={AdminProfile} />
        <Route path="/online-users" component={OnlineUsers} />
        <Route path="/balance" component={Balance} />
        <Route path="/activity-logs" component={ActivityLogs} />
        <Route path="/relatorios" component={Reports} />
        <Route component={Dashboard} />
      </Switch>
    </AdminLayout>
  );
}

export default function AdminApp() {
  return (
    <ErrorBoundary>
      <AdminThemeProvider>
        <WouterRouter base={ADMIN_BASE}>
          <div className="admin-panel-root">
            <AdminRouter />
          </div>
        </WouterRouter>
      </AdminThemeProvider>
    </ErrorBoundary>
  );
}
