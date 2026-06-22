import { Switch, Route, Router as WouterRouter } from "wouter";
import { ErrorBoundary } from "@/admin/components/ErrorBoundary";
import { AdminThemeProvider } from "@/admin/contexts/AdminThemeContext";
import { Toaster } from "@/components/ui/sonner";
import AdminLayout from "@/admin/layout/Layout";
import AdminSecurityGate from "@/admin/AdminSecurityGate";
import Dashboard from "@/admin/pages/dashboard";
import Matches from "@/admin/pages/matches";
import MatchDetail from "@/admin/pages/matches/detail";
import Players from "@/admin/pages/players";
import PlayerDetail from "@/admin/pages/players/detail";
import Transactions from "@/admin/pages/transactions";
import Messages from "@/admin/pages/messages";
import Reports from "@/admin/pages/reports";
import Withdrawals from "@/admin/pages/withdrawals";
import Notifications from "@/admin/pages/notifications";
import Settings from "@/admin/pages/settings";
import OnlineUsers from "@/admin/pages/online-users";
import Balance from "@/admin/pages/balance";
import BlockUsers from "@/admin/pages/block-users";
import Security from "@/admin/pages/security";
import ActivityLogs from "@/admin/pages/activity-logs";
import DepositRequests from "@/admin/pages/deposit-requests";
import BotManagement from "@/admin/pages/bots";
import AffiliatesPage from "@/admin/pages/affiliates";
import GameManagement from "@/admin/pages/game-management";

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
const ADMIN_BASE = `${BASE}/admin`;

function AdminRouter() {
  return (
    <AdminLayout>
      <Switch>
        <Route path="/"             component={Dashboard}    />
        <Route path="/matches"      component={Matches}      />
        <Route path="/matches/:id"  component={MatchDetail}  />
        <Route path="/players"      component={Players}      />
        <Route path="/players/:id"  component={PlayerDetail} />
        <Route path="/transactions" component={Transactions} />
        <Route path="/messages"     component={Messages}     />
        <Route path="/reports"      component={Reports}      />
        <Route path="/withdrawals"  component={Withdrawals}  />
        <Route path="/notifications" component={Notifications} />
        <Route path="/settings"     component={Settings}     />
        <Route path="/online-users" component={OnlineUsers}  />
        <Route path="/balance"      component={Balance}      />
        <Route path="/block-users"  component={BlockUsers}   />
        <Route path="/security"     component={Security}     />
        <Route path="/activity-logs" component={ActivityLogs} />
        <Route path="/deposit-requests" component={DepositRequests} />
        <Route path="/relatorios"   component={Reports}      />
        <Route path="/bots"            component={BotManagement}   />
        <Route path="/affiliates"      component={AffiliatesPage}  />
        <Route path="/game-management" component={GameManagement}  />
        <Route component={Dashboard} />
      </Switch>
    </AdminLayout>
  );
}

export default function AdminApp() {
  return (
    <ErrorBoundary>
      <AdminThemeProvider>
        <AdminSecurityGate>
          <WouterRouter base={ADMIN_BASE}>
            <div className="admin-panel-root">
              <AdminRouter />
              <Toaster position="top-right" richColors />
            </div>
          </WouterRouter>
        </AdminSecurityGate>
      </AdminThemeProvider>
    </ErrorBoundary>
  );
}
