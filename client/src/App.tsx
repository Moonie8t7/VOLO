/**
 * Routes and providers.
 *
 * Client-side routing only, so the host must rewrite unmatched paths to
 * index.html or a refresh on /optimise returns a 404.
 */

import { Switch, Route } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { StoreProvider } from "@/lib/store";
import Layout from "@/components/Layout";
import LandingPage from "@/pages/LandingPage";
import ImportPage from "@/pages/ImportPage";
import OptimisePage from "@/pages/OptimisePage";
import ExportPage from "@/pages/ExportPage";
import SubmitPage from "@/pages/SubmitPage";
import MasterlistPage from "@/pages/MasterlistPage";
import DonationsPage from "@/pages/DonationsPage";
import NotFound from "@/pages/not-found";
import { usePageMeta } from "@/lib/head";

function Router() {
  usePageMeta();
  return (
    <Layout>
      <Switch>
        <Route path="/" component={LandingPage} />
        <Route path="/import" component={ImportPage} />
        <Route path="/optimise" component={OptimisePage} />
        {/* Legacy US-spelled path, kept so old links don't break. */}
        <Route path="/optimizer" component={OptimisePage} />
        <Route path="/export" component={ExportPage} />
        <Route path="/submit" component={SubmitPage} />
        <Route path="/masterlist" component={MasterlistPage} />
        <Route path="/donations" component={DonationsPage} />
        <Route path="/support" component={DonationsPage} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </StoreProvider>
  );
}
