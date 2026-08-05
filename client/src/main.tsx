/**
 * Entry point. Mounts the app; everything else lives in App.
 */

import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
