import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
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
import { trpc } from "./lib/trpc";
import "./access.css";
import "./theme-refresh.css";

function Router(){return <Switch><Route path="/" component={Home}/><Route path="/months" component={MonthlyComparison}/><Route path="/pricing" component={Pricing}/><Route path="/expenses" component={Expenses}/><Route path="/inventory" component={Inventory}/><Route path="/stores" component={Stores}/><Route path="/compare" component={CompareStores}/><Route path="/portfolio" component={Portfolio}/><Route path="/pilot" component={Pilot}/><Route path="/import" component={ImportData}/><Route path="/manage" component={ManageData}/><Route path="/profile" component={Profile}/><Route path="/access" component={AccessAdmin}/><Route path="/history" component={ChangeLog}/><Route path="/notifications" component={Notifications}/><Route path="/404" component={NotFound}/><Route component={NotFound}/></Switch>}

function LocalAccessGate(){const session=trpc.localAuth.me.useQuery(undefined,{retry:false});if(session.isLoading)return <div className="app-loading">Проверяем доступ…</div>;if(!session.data)return <Login/>;return <Router/>}

export default function App(){return <ErrorBoundary><ThemeProvider defaultTheme="light"><AuditProvider><TooltipProvider><Toaster/><LocalAccessGate/></TooltipProvider></AuditProvider></ThemeProvider></ErrorBoundary>}
