import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import Admin from "@/pages/Admin";
import CompanyMatch from "@/pages/CompanyMatch";
import NotFound from "@/pages/NotFound";
import Profiles from "@/pages/Profiles";
import Saved from "@/pages/Saved";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { LocaleProvider } from "./contexts/LocaleContext";
import { ThemeProvider } from "./contexts/ThemeContext";

function Router() {
  return <Switch><Route path="/" component={CompanyMatch} /><Route path="/company-match" component={CompanyMatch} /><Route path="/profiles" component={Profiles} /><Route path="/match" component={CompanyMatch} /><Route path="/saved" component={Saved} /><Route path="/admin" component={Admin} /><Route path="/404" component={NotFound} /><Route component={NotFound} /></Switch>;
}

export default function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="light"><LocaleProvider><TooltipProvider><Toaster richColors position="top-right" /><Router /></TooltipProvider></LocaleProvider></ThemeProvider></ErrorBoundary>;
}
