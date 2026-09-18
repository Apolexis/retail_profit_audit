import { Toaster } from "@/components/ui/sonner";
import { DecimalInputNormalizerBootstrap } from "@/components/DecimalInputNormalizerBootstrap";
import { OceanLoader } from "@/components/OceanLoader";
import { SortableTablesBootstrap } from "@/components/SortableTablesBootstrap";
import { toast } from "sonner";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuditProvider } from "./contexts/AuditContext";
import Home from "./pages/Home";
import MonthlyComparison from "./pages/MonthlyComparison";
import Pricing from "./pages/Pricing";
import Expenses from "./pages/Expenses";
import Inventory from "./pages/Inventory";
import Stores from "./pages/Stores";
import CompareStores from "./pages/CompareStores";
import Portfolio from "./pages/Portfolio";
import Pilot from "./pages/Pilot";
import ImportData from "./pages/ImportData";
import ManageData from "./pages/ManageData";
import Login from "./pages/Login";
import Profile from "./pages/Profile";
import AccessAdmin from "./pages/AccessAdmin";
import ChangeLog from "./pages/ChangeLog";
import Notifications from "./pages/Notifications";
import ControlCenter from "./pages/ControlCenter";
import WeeklyReports from "./pages/WeeklyReports";
import OperationalCadence from "./pages/OperationalCadence";
import PlanFact from "./pages/PlanFact";
import Forecast from "./pages/Forecast";
import PriceControl from "./pages/PriceControl";
import RevenueRegistry from "./pages/RevenueRegistry";
import InventoryRegistry from "./pages/InventoryRegistry";
import StockControl from "./pages/StockControl";
import CatalogControl from "./pages/CatalogControl";
import CatalogProductEditor from "./pages/CatalogProductEditor";
import WarehouseControl from "./pages/WarehouseControl";
import EvotorSalesAnalytics from "./pages/EvotorSalesAnalytics";
import { trpc } from "./lib/trpc";
import "./access.css";
import "./theme-refresh.css";
import "./ios-light-theme.css";
import "./design-system.css";
import "./final-overrides.css";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/months" component={MonthlyComparison} />
      <Route path="/pricing" component={Pricing} />
      <Route path="/expenses" component={Expenses} />
      <Route path="/inventory" component={Inventory} />
      <Route path="/stores" component={Stores} />
      <Route path="/compare" component={CompareStores} />
      <Route path="/portfolio" component={Portfolio} />
      <Route path="/pilot" component={Pilot} />
      <Route path="/control" component={ControlCenter} />
      <Route path="/cadence" component={OperationalCadence} />
      <Route path="/forecast" component={Forecast} />
      <Route path="/planfact" component={PlanFact} />
      <Route path="/price-control/import">
        <PriceControl section="import" />
      </Route>
      <Route path="/price-control/directory">
        <PriceControl section="directory" />
      </Route>
      <Route path="/price-control">
        <PriceControl />
      </Route>
      <Route path="/revenue" component={RevenueRegistry} />
      <Route path="/stock-control" component={StockControl} />
      <Route path="/inventory-control" component={InventoryRegistry} />
      <Route path="/catalog-control/new"><CatalogProductEditor /></Route>
      <Route path="/catalog-control/:id/edit">{params => <CatalogProductEditor productId={Number(params.id)} />}</Route>
      <Route path="/catalog-control" component={CatalogControl} />
      <Route path="/warehouse-control" component={WarehouseControl} />
      <Route path="/evotor-sales/metrics"><EvotorSalesAnalytics kind="metrics" /></Route>
      <Route path="/evotor-sales/products"><EvotorSalesAnalytics kind="products" /></Route>
      <Route path="/import" component={ImportData} />
      <Route path="/manage" component={ManageData} />
      <Route path="/profile" component={Profile} />
      <Route path="/access" component={AccessAdmin} />
      <Route path="/history" component={ChangeLog} />
      <Route path="/notifications" component={Notifications} />
      <Route path="/reports" component={WeeklyReports} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AdminSignalOnLogin() {
  const [_, setLocation] = useLocation();
  const session = trpc.localAuth.me.useQuery(undefined, { retry: false });
  const notifications = trpc.localAuth.notifications.useQuery(
    { limit: 10 },
    { retry: false }
  );
  const delivered = useRef(false);
  useEffect(() => {
    if (
      delivered.current ||
      session.data?.role !== "admin" ||
      notifications.isLoading
    )
      return;
    const critical = (notifications.data?.items ?? []).filter(
      item => item.severity === "critical" && !item.isRead
    );
    const key = `audit-critical-signals-${session.data.id}`;
    if (!critical.length || sessionStorage.getItem(key)) {
      delivered.current = true;
      return;
    }
    sessionStorage.setItem(key, "1");
    delivered.current = true;
    toast.error(`Критичных сигналов: ${critical.length}`, {
      description:
        "Проверьте изменения показателей, импорт и риск-события в центре сигналов.",
      action: {
        label: "Открыть",
        onClick: () => setLocation("/notifications"),
      },
    });
  }, [session.data, notifications.data, notifications.isLoading, setLocation]);
  return null;
}

const sellerPaths = new Set(["/revenue", "/stock-control", "/inventory-control", "/profile"]);
const managerPaths = new Set(["/stock-control", "/inventory-control", "/profile"]);

function SellerRouteGate({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const allowed = sellerPaths.has(location);
  useEffect(() => {
    if (!allowed) setLocation("/revenue");
  }, [allowed, setLocation]);
  return allowed ? <>{children}</> : <div className="app-loading"><OceanLoader overlay label="Открываем операционный контур…" /></div>;
}

function InitialPasswordGate({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const allowed = location === "/profile";
  useEffect(() => {
    if (!allowed) setLocation("/profile");
  }, [allowed, setLocation]);
  return allowed ? <>{children}</> : <div className="app-loading"><OceanLoader overlay label="Требуется смена пароля…" /></div>;
}

function ManagerRouteGate({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const allowed = managerPaths.has(location);
  useEffect(() => {
    if (!allowed) setLocation("/inventory-control");
  }, [allowed, setLocation]);
  return allowed ? <>{children}</> : <div className="app-loading"><OceanLoader overlay label="Открываем управление магазинами…" /></div>;
}

function LocalAccessGate() {
  const session = trpc.localAuth.me.useQuery(undefined, { retry: false });
  const loaderPreview =
    import.meta.env.DEV &&
    new URLSearchParams(window.location.search).has("loader-preview");
  if (loaderPreview || session.isLoading)
    return (
      <div className="app-loading">
        <OceanLoader overlay label="Проверяем безопасный доступ…" />
      </div>
    );
  if (session.error) return <Login accessError={session.error} />;
  if (!session.data) return <Login />;
  if (session.data.mustChangePassword) return <InitialPasswordGate><Router /></InitialPasswordGate>;
  if (session.data.role === "seller") return <SellerRouteGate><Router /></SellerRouteGate>;
  if (session.data.role === "manager") return <ManagerRouteGate><Router /></ManagerRouteGate>;
  return (
    <>
      <AdminSignalOnLogin />
      <Router />
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <AuditProvider>
          <TooltipProvider>
            <Toaster />
            <DecimalInputNormalizerBootstrap />
            <SortableTablesBootstrap />
            <LocalAccessGate />
          </TooltipProvider>
        </AuditProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
