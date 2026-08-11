/**
 * Routes and providers.
 *
 * Each route is rendered to its own HTML file at build time, so a refresh or a
 * cold link lands on a real page rather than on the shell. Routing after that
 * is client side as usual.
 */

import { Switch, Route, Router as WouterRouter } from "wouter";
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
import AboutPage from "@/pages/AboutPage";
import MeasuredPage from "@/pages/MeasuredPage";
import PrivacyPage from "@/pages/PrivacyPage";
import NotFound from "@/pages/not-found";
import { usePageMeta } from "@/lib/head";

/**
 * The route table, inside the page shell.
 *
 * Every path here also needs an entry in scripts/prerender.mjs, or it has no
 * file of its own once deployed and the host answers 404. The smoke test
 * asserts the two lists match.
 */
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
        <Route path="/about" component={AboutPage} />
        <Route path="/measured" component={MeasuredPage} />
        <Route path="/privacy" component={PrivacyPage} />
        <Route path="/donations" component={DonationsPage} />
        <Route path="/support" component={DonationsPage} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

/**
 * `ssrPath` renders one route to HTML at build time, where there is no address
 * bar for wouter to read. In the browser it is left undefined and routing works
 * from the URL as usual.
 */
export default function App({ ssrPath }: { ssrPath?: string }) {
  return (
    <WouterRouter ssrPath={ssrPath}>
      <StoreProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </StoreProvider>
    </WouterRouter>
  );
}
