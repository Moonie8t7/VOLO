import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Official platform logomarks as inline SVGs, in each platform's brand colour.
 * The marks are what people recognise; the deliberate stop short of the full
 * embed widgets is because those load third-party scripts and set cookies,
 * which does not belong on a site whose pitch is that nothing leaves the
 * browser.
 */
const KofiMark = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="#FF5E5B" aria-hidden="true">
    <path d="M23.881 8.948c-.773-4.085-4.859-4.593-4.859-4.593H.723c-.604 0-.679.798-.679.798s-.082 7.324-.022 11.822c.164 2.424 2.586 2.672 2.586 2.672s8.267-.023 11.966-.049c2.438-.426 2.683-2.566 2.658-3.734 4.352.24 7.422-2.831 6.649-6.916zm-11.062 3.511c-1.246 1.453-4.011 3.976-4.011 3.976s-.121.119-.31.023c-.076-.057-.108-.09-.108-.09-.443-.441-3.368-3.049-4.034-3.954-.709-.965-1.041-2.7-.091-3.71.951-1.01 3.005-1.086 4.363.407 0 0 1.565-1.782 3.468-.963 1.904.82 1.832 3.011.723 4.311zm6.173.478c-.928.116-1.682.028-1.682.028V7.284h1.77s1.971.551 1.971 2.638c0 1.913-.985 2.667-2.059 3.015z" />
  </svg>
);

const PatreonMark = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="#FF424D" aria-hidden="true">
    <path d="M0 .48v23.04h4.22V.48zm15.385 0c-4.764 0-8.641 3.88-8.641 8.65 0 4.755 3.877 8.623 8.641 8.623 4.75 0 8.615-3.868 8.615-8.623C24 4.36 20.136.48 15.385.48z" />
  </svg>
);

const PayPalMark = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="#0079C1" aria-hidden="true">
    <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106zm14.146-14.42a3.35 3.35 0 0 0-.607-.541c-.013.076-.026.175-.041.254-.93 4.778-4.005 7.201-9.138 7.201h-2.19a.563.563 0 0 0-.556.479l-1.187 7.527h-.506l-.24 1.516a.56.56 0 0 0 .554.647h3.882c.46 0 .85-.334.922-.788.06-.26.76-4.852.816-5.09a.932.932 0 0 1 .923-.788h.58c3.76 0 6.705-1.528 7.565-5.946.36-1.847.174-3.388-.777-4.471z" />
  </svg>
);

interface DonationPlatform {
  name: string;
  description: string;
  icon: React.ReactNode;
  url: string;
}

const donationPlatforms: DonationPlatform[] = [
  {
    name: "Ko-fi",
    description: "One-off",
    icon: <KofiMark />,
    url: "https://ko-fi.com/volo_bg3",
  },
  {
    name: "Patreon",
    description: "Monthly",
    icon: <PatreonMark />,
    url: "https://patreon.com/volo_bg3",
  },
  {
    name: "PayPal",
    description: "One-off",
    icon: <PayPalMark />,
    url: "https://paypal.me/volo_bg3",
  },
];

interface DonationSectionProps {
  variant?: "full" | "compact" | "buttons";
  className?: string;
}

export default function DonationSection({ variant = "full", className = "" }: DonationSectionProps) {
  if (variant === "buttons") {
    return (
      <div className={`flex flex-wrap justify-center gap-3 ${className}`}>
        {donationPlatforms.map(platform => (
          <Button
            key={platform.name}
            onClick={() => window.open(platform.url, "_blank", "noopener")}
          >
            {platform.icon}
            <span>{platform.name}</span>
            <span className="opacity-60 normal-case">({platform.description})</span>
            <ExternalLink className="h-3 w-3 opacity-60" />
          </Button>
        ))}
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <span className="text-sm text-muted-foreground">Support VOLO:</span>
        <div className="flex gap-2">
          {donationPlatforms.map(platform => (
            <Button
              key={platform.name}
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={() => window.open(platform.url, "_blank", "noopener")}
            >
              {platform.icon}
              <span className="ml-1">{platform.name}</span>
            </Button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`border border-border/40 bg-black/25 p-8 ${className}`}>
      <h2 className="font-display text-xl font-bold mb-4" style={{ color: "hsl(var(--bg3-header))" }}>
        Support VOLO
      </h2>
      <p className="text-sm text-muted-foreground leading-relaxed mb-6 max-w-2xl">
        VOLO is free and stays free. There is nothing to pay for and no server
        bill to cover. If it saved you an evening of load order wrangling and
        you feel like putting something in the tip jar, these work:
      </p>

      <div className="flex flex-wrap justify-center gap-3">
        {donationPlatforms.map(platform => (
          <Button
            key={platform.name}
            onClick={() => window.open(platform.url, "_blank", "noopener")}
          >
            {platform.icon}
            <span>{platform.name}</span>
            <span className="opacity-60 normal-case">({platform.description})</span>
            <ExternalLink className="h-3 w-3 opacity-60" />
          </Button>
        ))}
      </div>
    </div>
  );
}
