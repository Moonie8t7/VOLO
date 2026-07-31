import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import Sidebar from "./Sidebar";

/**
 * Below lg the nav is a top bar, so the shell stacks vertically. From lg up it
 * becomes a two-column layout with a fixed sidebar.
 */
export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const main = useRef<HTMLElement>(null);
  const firstRender = useRef(true);

  // A client-side route change replaces the content without moving focus, so a
  // keyboard or screen reader user stays wherever they were and hears nothing.
  // Moving focus to the new main region restores the behaviour of a page load.
  // Skipped on first render so the browser can honour a deep-linked anchor.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    main.current?.focus();
  }, [location]);

  // The landing page carries its own full-bleed layout.
  if (location === "/") return <>{children}</>;

  return (
    <div className="flex min-h-screen flex-col bg-background lg:h-screen lg:flex-row lg:overflow-hidden">
      {/* Visible only once focused, so keyboard users can jump the nav. */}
      <a
        href="#main"
        className="sr-only rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground
          focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50"
      >
        Skip to content
      </a>

      <Sidebar />

      <main
        id="main"
        ref={main}
        tabIndex={-1}
        className="flex-1 focus:outline-none lg:overflow-auto"
      >
        {children}
      </main>
    </div>
  );
}
