import { Heart, Coffee, Users, ExternalLink, Gift, Sparkles, Crown } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import DonationSection from "@/components/DonationSection";

const supportTiers = [
  {
    name: "Coffee Support",
    icon: <Coffee className="h-8 w-8" />,
    description: "Buy us a coffee to fuel late-night development sessions",
    amount: "£3-5",
    benefits: ["Our eternal gratitude", "Good karma points"],
    color: "border-orange-500/30 bg-gradient-to-br from-card/80 to-card/40"
  },
  {
    name: "Regular Support",
    icon: <Heart className="h-8 w-8" />,
    description: "Monthly support to keep the servers running",
    amount: "£5-15/month",
    benefits: ["Priority feature requests", "Early access to updates", "Discord supporter role"],
    color: "border-bg3-gold/30 bg-gradient-to-br from-card/80 to-bg3-gold/10",
    popular: true
  },
  {
    name: "Champion Support",
    icon: <Crown className="h-8 w-8" />,
    description: "Help us expand and improve VOLO significantly",
    amount: "£25+/month",
    benefits: ["Direct developer contact", "Custom feature discussions", "Special recognition", "Input on roadmap"],
    color: "border-yellow-500/30 bg-gradient-to-br from-card/80 to-card/40"
  }
];

const whySupport = [
  {
    title: "Server Hosting",
    description: "Keep VOLO running 24/7 with reliable hosting infrastructure",
    icon: <Sparkles className="h-6 w-6 text-foreground" />
  },
  {
    title: "Development Time",
    description: "Support ongoing development, bug fixes, and new features",
    icon: <Coffee className="h-6 w-6 text-foreground" />
  },
  {
    title: "Community Tools",
    description: "Maintain and expand the masterlist database and conflict detection",
    icon: <Users className="h-6 w-6 text-foreground" />
  },
  {
    title: "Open Source",
    description: "Keep VOLO free and open-source for the entire BG3 community",
    icon: <Gift className="h-6 w-6 text-foreground" />
  }
];

export default function DonationsPage() {
  return (
    <div className="overflow-auto bg-gradient-to-br from-background via-background to-card">
      <div className="p-8 max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-start gap-6 mb-6">
            <div className="w-16 h-16 rounded-lg shadow-bg3 border border-border overflow-hidden">
              <img 
                src="/assets/volo-logo.png" 
                alt="VOLO Logo" 
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1">
              <h1 className="text-4xl font-display font-bold text-gradient-bg3 mb-2">Support VOLO</h1>
              <p className="text-lg font-subheader mb-1">Help us maintain this community tool</p>
              <p className="text-sm text-muted-foreground/80 font-body">Voluntary donations to keep VOLO running</p>
            </div>
          </div>
          
          <div className="bg-card/50 border border-border rounded-lg p-6 shadow-bg3">
            <p className="text-foreground/90 leading-relaxed">
              VOLO is built by modders, for modders. Like many mod authors in the BG3 community, 
              we accept voluntary donations to help cover costs and support ongoing development. 
              Every contribution helps us maintain servers, improve features, and keep this tool free for everyone.
            </p>
          </div>
        </div>

        {/* Quick Donation Section */}
        <div className="mb-12">
          <DonationSection />
        </div>

        {/* Support Tiers */}
        <div className="mb-12">
          <h2 className="text-2xl font-display font-bold text-gradient-bg3 mb-6">Support Tiers</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {supportTiers.map((tier) => (
              <Card key={tier.name} className={`relative ${tier.color} border-2 ${tier.popular ? 'ring-2 ring-destructive/20' : ''}`}>
                {tier.popular && (
                  <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-destructive text-white px-3 py-1">
                    Most Popular
                  </Badge>
                )}
                <CardHeader className="text-center pb-4">
                  <div className="mx-auto mb-3 p-3 rounded-full bg-bg3-gold/20">
                    {tier.icon}
                  </div>
                  <CardTitle className="font-display text-xl">{tier.name}</CardTitle>
                  <CardDescription className="text-sm">{tier.description}</CardDescription>
                  <div className="text-2xl font-bold text-foreground mt-2">{tier.amount}</div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {tier.benefits.map((benefit, index) => (
                      <li key={index} className="flex items-center gap-2 text-sm">
                        <Heart className="h-4 w-4 text-destructive flex-shrink-0" />
                        <span>{benefit}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Why Support */}
        <div className="mb-12">
          <h2 className="text-2xl font-display font-bold text-gradient-bg3 mb-6">Why Support VOLO?</h2>
          <div className="grid gap-6 md:grid-cols-2">
            {whySupport.map((reason) => (
              <Card key={reason.title} className="border-bg3 shadow-bg3">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="p-2 rounded-lg bg-muted/50">
                      {reason.icon}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-display font-semibold text-lg mb-2">{reason.title}</h3>
                      <p className="text-muted-foreground text-sm leading-relaxed">{reason.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Transparency */}
        <Card className="border-bg3 shadow-bg3">
          <CardHeader>
            <CardTitle className="font-display text-xl text-gradient-bg3 flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Transparency & Ethics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 text-sm text-muted-foreground leading-relaxed">
              <p>
                <strong className="text-foreground">100% Voluntary:</strong> VOLO will always remain completely free. 
                Donations are entirely optional and never required to access any features.
              </p>
              <p>
                <strong className="text-foreground">Open Source:</strong> All code is publicly available, 
                and donations help us maintain this commitment to transparency.
              </p>
              <p>
                <strong className="text-foreground">Community First:</strong> Like mod authors who accept donations, 
                we believe in community-supported tools that serve modders' needs.
              </p>
              <p>
                <strong className="text-foreground">Funds Usage:</strong> Donations go toward server hosting, 
                development time, and maintaining the masterlist database that powers VOLO's intelligence.
              </p>
            </div>
            
            <div className="pt-4 border-t border-border/50">
              <p className="text-xs text-muted-foreground/80 italic">
                "Inspired by the generosity of the BG3 modding community, built with love for fellow modders."
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}