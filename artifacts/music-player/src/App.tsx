import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout/app-layout";
import Home from "@/pages/home";
import Downloads from "@/pages/downloads";
import Folder from "@/pages/folder";
import Settings from "@/pages/settings";
import NotFound from "@/pages/not-found";
import { useCapacitorInit } from "@/hooks/use-capacitor";
import { setBaseUrl } from "@workspace/api-client-react";
import { getApiBaseUrl } from "@/lib/api-url";

// Point API calls to the deployed backend when running as a native app
setBaseUrl(getApiBaseUrl() || null);

const queryClient = new QueryClient();

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/downloads" component={Downloads} />
        <Route path="/folders/:id" component={Folder} />
        <Route path="/settings" component={Settings} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  // Creates the Sanctuary music folder and hides splash screen on native
  useCapacitorInit();

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL?.replace(/\/$/, "") ?? ""}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
