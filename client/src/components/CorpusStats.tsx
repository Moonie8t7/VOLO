/**
 * The corpus in figures: a band of four, then two charts. The band is the
 * site's awards panel, the width of the page under the copy. The charts
 * are plain SVG drawn from the summary the miner writes and from the
 * held-out measurement, styled after Larian's anniversary infographics:
 * parchment bars with a bright cap, dotted gridlines with a dot at one end
 * and the tick values at the right, two-tone serif titles with a unit line
 * beneath, and a table behind each chart for anyone who wants the numbers.
 * Nothing here is typed by hand.
 */

import { useState, type ReactNode } from "react";
import { longDate, shortDate } from "@/lib/dates";
import summary from "@/lib/masterlist-summary.json";
import { HELD_OUT, RANDOM } from "@/lib/measured-stats";

const GOLD = "hsl(var(--bg3-gold))";
const HEADER = "hsl(var(--bg3-header))";
const INK = "rgb(255 255 255 / 0.65)";
const TICK = "rgb(215 168 105 / 0.8)";
const GRID = "rgb(215 168 105 / 0.4)";
const CAP = "#f7ecd8";
const SERIF = "'EB Garamond', serif";

/** Grouped thousands, in one locale so the prerender and the browser agree. */
const figure = (v: number) => v.toLocaleString("en-GB");

/** The last words of a title in gold, as the infographics set theirs. */
function Gold({ children }: { children: ReactNode }) {
  return <span style={{ color: GOLD }}>{children}</span>;
}

/**
 * The placement sources grouped as the labels on a sorted order group them.
 * A played order is the strongest evidence, whether the mod was filed there
 * itself, filed there by most orders, or placed between its neighbours.
 */
const SOURCES = [
  { keys: ["section", "section-majority", "inferred"], name: "Played orders" },
  { keys: ["name-pattern"], name: "The mod's name" },
  { keys: ["external-category"], name: "Nexus or mod.io listing" },
  { keys: ["none"], name: "Unplaced" },
  { keys: ["curated"], name: "Curated by hand" },
  { keys: ["author-catalogue"], name: "The author's other mods" },
];

const PLACEMENTS = (() => {
  const counts = summary.placements as Record<string, number>;
  const rows = SOURCES.map(s => ({
    name: s.name,
    value: s.keys.reduce((sum, key) => sum + (counts[key] ?? 0), 0),
  }));
  const named = new Set(SOURCES.flatMap(s => s.keys));
  const other = Object.entries(counts)
    .filter(([key]) => !named.has(key))
    .reduce((sum, [, v]) => sum + v, 0);
  if (other > 0) rows.push({ name: "Other", value: other });
  return rows.sort((a, b) => b.value - a.value);
})();

const WEEKS = summary.weekly;

export function StatBand() {
  const tiles = [
    {
      label: "Mods in the masterlist",
      value: figure(summary.mods),
      note: `${figure(summary.placed)} with a placement`,
    },
    {
      label: "Orders submitted",
      value: figure(summary.orders),
      note: `${figure(summary.workingOrders)} reported working`,
    },
    {
      label: "Agreement with players",
      value: `${HELD_OUT}%`,
      note: `against ${RANDOM}% by chance`,
    },
    summary.catalogue
      ? {
          label: "Catalogue listings read",
          value: figure(summary.catalogue.distinct),
          note: "Nexus Mods and mod.io",
        }
      : {
          label: "Mods left unplaced",
          value: figure(summary.uncategorised),
          note: "waiting at the end of an order",
        },
  ];

  return (
    <div className="panel-bg3">
      <div className="frame-bg3 frame-decor">
        <div className="flex flex-col gap-8 p-10 md:flex-row md:items-center">
          <div className="shrink-0 md:mr-6">
            <span className="font-subheader mb-1 block text-[13px]">Masterlist</span>
            <h3 className="fluid-h2">In <Gold>numbers</Gold></h3>
          </div>
          {/* Each figure is shown first and its label under it, so a label
              that wraps cannot push one figure below its neighbour. The list
              keeps its term-first order for a screen reader. */}
          <dl className="grid flex-1 grid-cols-2 gap-x-8 gap-y-6 lg:grid-cols-4">
            {tiles.map(t => (
              <div key={t.label} className="flex flex-col">
                <dt className="order-2 text-[13px] leading-5 text-white/65">{t.label}</dt>
                <dd className="order-1 font-display fluid-h3">{t.value}</dd>
                <dd className="order-3 text-[13px] leading-5 text-white/50">{t.note}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
}

/**
 * One frame for both charts, with the table behind a toggle. The chart is
 * the default because it is what the prerendered page shows.
 */
function ChartCard({ eyebrow, title, unit, note, chart, table }: {
  eyebrow: string;
  title: ReactNode;
  unit: string;
  note: string;
  chart: ReactNode;
  table: ReactNode;
}) {
  const [asTable, setAsTable] = useState(false);
  return (
    <figure className="box-bg3 px-10 py-6">
      <figcaption>
        <span className="font-subheader block text-[13px]">{eyebrow}</span>
        <h3 className="fluid-h4 mt-2">{title}</h3>
        <p className="mb-5 mt-1 text-[13px] leading-5 text-white/50">{unit}</p>
      </figcaption>
      {asTable ? table : chart}
      <p className="mt-4 text-[13px] leading-5 text-white/50">{note}</p>
      {/* Padded to a 30px target; the 22px line alone is under the minimum. */}
      <button
        type="button"
        className="link-simple mt-2 py-1"
        aria-pressed={asTable}
        onClick={() => setAsTable(v => !v)}
      >
        {asTable ? "Show as chart" : "Show as table"}
      </button>
    </figure>
  );
}

function Table({ caption, head, rows }: {
  caption: string;
  head: [string, string];
  rows: [string, string][];
}) {
  return (
    <table className="w-full text-sm">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr className="border-b border-border/60 text-left text-white/65">
          <th scope="col" className="py-2 pr-4 font-medium">{head[0]}</th>
          <th scope="col" className="py-2 text-right font-medium">{head[1]}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([name, value]) => (
          <tr key={name} className="border-b border-border/30">
            <td className="py-2 pr-4">{name}</td>
            <td className="py-2 text-right tabular-nums">{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * The bar material, as the infographics paint theirs: the site's button
 * parchment, darkening towards the foot. The tile is the whole chart, so
 * no seam from a repeat crosses a bar. Both are defined once per chart,
 * because two charts on one page cannot share an id.
 *
 * @param id a prefix unique to the chart
 * @param width the chart's width in its own units
 * @param height the chart's height in its own units
 * @returns the pattern and gradient definitions
 */
function Parchment({ id, width, height }: { id: string; width: number; height: number }) {
  return (
    <defs>
      <pattern id={`${id}-paper`} patternUnits="userSpaceOnUse" width={width} height={height}>
        <image
          href="/assets/bg3/jpg/texture-button.jpg"
          width={width}
          height={height}
          preserveAspectRatio="xMidYMid slice"
        />
      </pattern>
      <linearGradient id={`${id}-shade`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#3b2a17" stopOpacity="0.42" />
        <stop offset="1" stopColor="#3b2a17" stopOpacity="0.7" />
      </linearGradient>
    </defs>
  );
}

/**
 * A parchment bar with the bright cap the infographics draw along the top
 * of every bar, a little wider than the bar itself.
 */
function Bar({ id, x, y, width, height }: {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}) {
  return (
    <>
      <rect x={x} y={y} width={width} height={height} fill={`url(#${id}-paper)`} />
      <rect x={x} y={y} width={width} height={height} fill={`url(#${id}-shade)`} />
      <line x1={x - 3} x2={x + width + 3} y1={y} y2={y} stroke={CAP} strokeWidth="1.5" />
    </>
  );
}

/**
 * Columns, one per week, on a dotted grid stepped in fives or tens with the
 * tick values at the right. Only the tallest column and the newest carry a
 * figure; the rest are read off the grid, the tooltip, or the table.
 */
function WeeklyChart() {
  const W = 520, H = 240, L = 16, R = 44, T = 28, B = 36;
  const plotW = W - L - R;
  const plotH = H - T - B;
  const max = Math.max(...WEEKS.map(w => w.orders), 1);
  const step = max > 40 ? 10 : 5;
  const top = Math.ceil(max / step) * step;
  const slot = plotW / WEEKS.length;
  const bar = slot * 0.56;
  const y = (v: number) => T + plotH - (v / top) * plotH;
  const peak = WEEKS.reduce((a, w) => (w.orders > a.orders ? w : a), WEEKS[0]);
  const last = WEEKS[WEEKS.length - 1];
  const ticks: number[] = [];
  for (let v = 0; v <= top; v += step) ticks.push(v);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full"
      role="img"
      aria-label={`Orders landed by week, from the week of ${longDate(WEEKS[0].week)} to the week of ${longDate(last.week)}`}
    >
      <Parchment id="weekly" width={W} height={H} />
      {ticks.map(v => (
        <g key={v}>
          <line
            x1={L}
            x2={W - R}
            y1={y(v)}
            y2={y(v)}
            stroke={v === 0 ? TICK : GRID}
            strokeWidth="1"
            strokeDasharray={v === 0 ? undefined : "1.5 4"}
          />
          <circle cx={L} cy={y(v)} r="2" fill={TICK} />
          <text x={W - R + 10} y={y(v)} dy="0.35em" fill={TICK} fontSize="11">
            {v}
          </text>
        </g>
      ))}
      {WEEKS.map((w, i) => {
        const x = L + i * slot + (slot - bar) / 2;
        const height = Math.max(y(0) - y(w.orders), w.orders ? 1 : 0);
        return (
          <g key={w.week}>
            <title>{`Week of ${longDate(w.week)}: ${w.orders} ${w.orders === 1 ? "order" : "orders"}`}</title>
            <Bar id="weekly" x={x} y={y(0) - height} width={bar} height={height} />
            {(w === peak || w === last) && (
              <text x={x + bar / 2} y={y(0) - height - 8} textAnchor="middle" fill={HEADER} fontSize="13">
                {w.orders}
              </text>
            )}
            <text x={x + bar / 2} y={H - 12} textAnchor="middle" fill={INK} fontSize="12">
              {shortDate(w.week)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/**
 * Bars, one per source, longest first, on a dotted grid with the counts at
 * the foot, each bar with its figure at the end. Six figures is few enough
 * to print, and the smallest bars would otherwise be a pixel with nothing
 * to say what it is.
 */
function PlacementChart() {
  const W = 520, ROW = 34, LABEL = 200, BAR = 250, B = 26;
  const H = PLACEMENTS.length * ROW + 8 + B;
  const max = Math.max(...PLACEMENTS.map(r => r.value), 1);
  const step = max > 5000 ? 2000 : max > 2000 ? 1000 : 500;
  const top = Math.ceil(max / step) * step;
  const scale = BAR / top;
  const ticks: number[] = [];
  for (let v = 0; v <= top; v += step) ticks.push(v);
  const foot = PLACEMENTS.length * ROW + 8;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full"
      role="img"
      aria-label="Where the masterlist's placements come from, by number of mods"
    >
      <Parchment id="sources" width={W} height={H} />
      {ticks.map(v => (
        <g key={v}>
          <line
            x1={LABEL + v * scale}
            x2={LABEL + v * scale}
            y1={4}
            y2={foot}
            stroke={v === 0 ? TICK : GRID}
            strokeWidth="1"
            strokeDasharray={v === 0 ? undefined : "1.5 4"}
          />
          <circle cx={LABEL + v * scale} cy={foot} r="2" fill={TICK} />
          <text x={LABEL + v * scale} y={foot + 16} textAnchor="middle" fill={TICK} fontSize="11">
            {figure(v)}
          </text>
        </g>
      ))}
      {PLACEMENTS.map((r, i) => {
        const rowTop = 4 + i * ROW;
        const width = Math.max(r.value * scale, r.value ? 1 : 0);
        return (
          <g key={r.name}>
            <title>{`${r.name}: ${figure(r.value)} mods`}</title>
            <text
              x={LABEL - 12}
              y={rowTop + ROW / 2}
              dy="0.35em"
              textAnchor="end"
              fill={GOLD}
              fontSize="14"
              fontFamily={SERIF}
              fontWeight="500"
            >
              {r.name}
            </text>
            <Bar id="sources" x={LABEL} y={rowTop + 7} width={width} height={ROW - 14} />
            <text x={LABEL + width + 8} y={rowTop + ROW / 2} dy="0.35em" fill={HEADER} fontSize="13">
              {figure(r.value)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function CorpusCharts() {
  const undated = summary.undated === 1
    ? "One order in the corpus carries no date and is left out."
    : `${summary.undated} orders in the corpus carry no date and are left out.`;
  const latest = summary.latest ? ` The newest landed on ${longDate(summary.latest)}.` : "";

  return (
    <div className="mb-16 mt-[30px] grid gap-[30px] md:grid-cols-2">
      <ChartCard
        eyebrow="Corpus growth"
        title={<>Orders landed <Gold>by week</Gold></>}
        unit="Orders in the corpus, by the week they landed"
        note={`Weeks start on a Monday. ${undated}${latest}`}
        chart={<WeeklyChart />}
        table={
          <Table
            caption="Orders landed by week"
            head={["Week of", "Orders"]}
            rows={WEEKS.map(w => [longDate(w.week), String(w.orders)])}
          />
        }
      />
      <ChartCard
        eyebrow="Evidence"
        title={<>Where placements <Gold>come from</Gold></>}
        unit="Mods in the masterlist, by the evidence behind the placement"
        note="The same groups label every row of a sorted order, so a guess never passes for evidence."
        chart={<PlacementChart />}
        table={
          <Table
            caption="Where placements come from"
            head={["Source", "Mods"]}
            rows={PLACEMENTS.map(r => [r.name, figure(r.value)])}
          />
        }
      />
    </div>
  );
}
