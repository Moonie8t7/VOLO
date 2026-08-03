import DonationSection from "@/components/DonationSection";

export default function DonationsPage() {
  return (
    <div className="p-8 overflow-auto min-h-screen bg-gradient-to-br from-background via-background to-card">
      <div className="max-w-3xl mx-auto space-y-10">
        <header>
          <h1 className="text-4xl font-display font-bold text-gradient-bg3">Support VOLO</h1>
        </header>

        <div className="space-y-4 leading-relaxed" style={{ color: "hsl(var(--bg3-main))" }}>
          <p>
            VOLO costs almost nothing to run. That is by design: the site is
            static, the sorting happens in your browser, and the hosting tier is
            free. The only real bill is the domain name.
          </p>
          <p>
            What it does cost is time: reviewing submitted load orders, keeping
            the masterlist in shape as patches land, and building the features
            still missing. If VOLO saved you an evening and you feel like buying
            the person behind it a coffee, that is what these are for. There are no
            tiers and no perks, and it all stays free either way.
          </p>
          <p>
            If you would rather give something more useful than money: play on
            an order, then submit it from the Export page. Verified orders are
            the thing this tool actually runs on.
          </p>
        </div>

        <DonationSection variant="buttons" />
      </div>
    </div>
  );
}
