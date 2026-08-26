/**
 * The frame of a load order, settling into it.
 *
 * The section this sits in described the frame in prose and showed nothing.
 * Names and sequence are the masterlist's own first six groups, so if that
 * order changes this is wrong and should change with it.
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";

/** useLayoutEffect warns during prerender, and neither effect runs there. */
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * The first six groups in masterlist order, each with the position a mod
 * manager hands it over at. Written down rather than shuffled, so the
 * prerendered HTML and the browser agree.
 */
const ROWS = [
  { name: "Top of Load Order", from: 3 },
  { name: "Resources", from: 5 },
  { name: "Utilities", from: 0 },
  { name: "Visuals", from: 4 },
  { name: "Animations", from: 1 },
  { name: "User Interface", from: 2 },
] as const;

/** Row pitch in rem. Every row translates by a multiple of it. */
const PITCH = 2.5;

export default function SortingDemo() {
  /**
   * Sorted is the default, not the end of an animation: it is what the
   * prerendered HTML and a reader without JavaScript get. The scramble is
   * applied after mount, and only when it is going to be animated away.
   */
  const [scrambled, setScrambled] = useState(false);
  const [settled, setSettled] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  useIsomorphicLayoutEffect(() => {
    if (typeof window === "undefined") return;
    if (!("IntersectionObserver" in window)) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setScrambled(true);
    setSettled(false);
  }, []);

  useEffect(() => {
    if (!scrambled || settled) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      entries => {
        if (entries.some(e => e.isIntersecting)) {
          setSettled(true);
          io.disconnect();
        }
      },
      { threshold: 0.55 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [scrambled, settled]);

  return (
    <figure className="mt-8 mb-2">
      <div
        ref={ref}
        className="relative border border-border/60 bg-card/40 px-4 py-4 sm:px-6"
        style={{ height: `${ROWS.length * PITCH + 1}rem` }}
      >
        {ROWS.map((row, to) => {
          const at = scrambled && !settled ? row.from : to;
          return (
            <div
              key={row.name}
              className="absolute left-4 right-4 flex items-center gap-3 sm:left-6 sm:right-6"
              style={{
                height: `${PITCH}rem`,
                transform: `translateY(${at * PITCH + 0.5}rem)`,
                transition: `transform ${360 + Math.abs(at - to) * 90}ms cubic-bezier(0.23, 1, 0.32, 1) ${to * 55}ms`,
              }}
            >
              <span
                className="font-mono text-[0.65rem] tabular-nums"
                style={{ color: "hsl(var(--bg3-main) / 0.7)" }}
                aria-hidden="true"
              >
                {String(to + 1).padStart(2, "0")}
              </span>
              <span
                className="font-subheader truncate text-xs sm:text-sm"
                style={{ color: "hsl(var(--bg3-small))" }}
              >
                {row.name}
              </span>
              <span className="h-px flex-1" style={{ backgroundColor: "hsl(var(--bg3-border) / 0.25)" }} />
            </div>
          );
        })}
      </div>
      <figcaption className="mt-3 text-sm" style={{ color: "hsl(var(--bg3-main) / 0.7)" }}>
        The first six sections of the frame, in the order VOLO files them. A
        hundred-odd more follow, down to compatibility patches at the bottom.
      </figcaption>
    </figure>
  );
}
