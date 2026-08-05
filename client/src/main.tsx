/**
 * Entry point. Mounts the app; everything else lives in App.
 *
 * Routes are prerendered to HTML at build time, so the usual job here is to
 * attach to markup that already exists rather than to build it from nothing.
 * createRoot would discard that markup and rebuild it, which shows as correct
 * content followed by a blank frame, so hydrate when there is something to
 * hydrate and only render fresh when there is not.
 */

import { createRoot, hydrateRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const container = document.getElementById("root")!;

if (container.hasChildNodes()) {
  hydrateRoot(container, <App />);
} else {
  createRoot(container).render(<App />);
}
