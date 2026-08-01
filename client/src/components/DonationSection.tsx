import { Heart, Coffee, Users, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

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
    icon: <Coffee className="h-4 w-4" />,
    url: "https://ko-fi.com/volo_bg3",
  },
  {
    name: "Patreon",
    description: "Monthly",
    icon: <Users className="h-4 w-4" />,
    url: "https://patreon.com/volo_bg3",
  },
  {
    name: "PayPal",
    description: "One-off",
    icon: <Heart className="h-4 w-4" />,
    url: "https://paypal.me/volo_bg3",
  },
];

interface DonationSectionProps {
  variant?: "full" | "compact";
  className?: string;
}

export default function DonationSection({ variant = "full", className = "" }: DonationSectionProps) {
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

      <div className="flex flex-wrap gap-3">
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
