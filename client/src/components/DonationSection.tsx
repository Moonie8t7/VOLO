import { Heart, Coffee, Users, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface DonationPlatform {
  name: string;
  description: string;
  icon: React.ReactNode;
  url: string;
  color: string;
  badge?: string;
}

const donationPlatforms: DonationPlatform[] = [
  {
    name: "Ko-fi",
    description: "Buy us a coffee to support development",
    icon: <Coffee className="h-5 w-5" />,
    url: "https://ko-fi.com/volo_bg3",
    color: "bg-[#FF5E5B] hover:bg-[#FF4E4B]",
    badge: "Popular"
  },
  {
    name: "Patreon",
    description: "Monthly support for ongoing development",
    icon: <Users className="h-5 w-5" />,
    url: "https://patreon.com/volo_bg3",
    color: "bg-[#FF424D] hover:bg-[#FF323D]"
  },
  {
    name: "PayPal",
    description: "One-time donation via PayPal",
    icon: <Heart className="h-5 w-5" />,
    url: "https://paypal.me/volo_bg3",
    color: "bg-[#0070BA] hover:bg-[#005EA6]"
  }
];

interface DonationSectionProps {
  variant?: "full" | "compact";
  className?: string;
}

export default function DonationSection({ variant = "full", className = "" }: DonationSectionProps) {
  if (variant === "compact") {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <Heart className="h-4 w-4 text-destructive animate-pulse" />
        <span className="text-sm font-medium text-muted-foreground">Support VOLO:</span>
        <div className="flex gap-2">
          {donationPlatforms.map((platform) => (
            <Button
              key={platform.name}
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs hover:text-foreground"
              onClick={() => window.open(platform.url, '_blank')}
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
    <Card className={`border-bg3 shadow-bg3 ${className}`}>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Heart className="h-6 w-6 text-destructive animate-pulse" />
          <div>
            <CardTitle className="font-display text-xl text-gradient-bg3">Support VOLO</CardTitle>
            <CardDescription className="font-body">
              Help us maintain and improve this community tool
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground leading-relaxed">
          <p className="mb-3">
            VOLO is a labour of love inspired by the incredible BG3 modding community. 
            Like many mod authors, we accept voluntary donations to help cover hosting costs 
            and support ongoing development.
          </p>
          <p className="text-xs opacity-75">
            <strong>Note:</strong> All donations are voluntary. VOLO will always remain free and open-source.
          </p>
        </div>
        
        <div className="grid gap-3 sm:grid-cols-1 lg:grid-cols-3">
          {donationPlatforms.map((platform) => (
            <Button
              key={platform.name}
              variant="outline"
              className={`h-auto p-4 border-border hover:border-border/80 transition-all duration-200 group ${platform.color} text-white border-transparent hover:scale-105`}
              onClick={() => window.open(platform.url, '_blank')}
            >
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="flex items-center gap-2">
                  {platform.icon}
                  <span className="font-medium">{platform.name}</span>
                  {platform.badge && (
                    <Badge variant="secondary" className="text-xs px-1.5 py-0.5 bg-white/20">
                      {platform.badge}
                    </Badge>
                  )}
                  <ExternalLink className="h-3 w-3 opacity-60 group-hover:opacity-100" />
                </div>
                <p className="text-xs opacity-90 leading-snug">
                  {platform.description}
                </p>
              </div>
            </Button>
          ))}
        </div>

        <div className="pt-4 border-t border-border/50">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Heart className="h-3 w-3 text-destructive" />
            <span>
              Every contribution helps us maintain servers, improve features, and support the BG3 community
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}