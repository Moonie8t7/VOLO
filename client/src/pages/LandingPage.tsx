import { Link } from "wouter";
import { ArrowRight, Upload, Zap, Users, Shield, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import DonationSection from "@/components/DonationSection";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative bg-gradient-bg3 overflow-hidden">
        <div className="absolute inset-0 bg-ornate/5"></div>
        
        <div className="relative max-w-4xl mx-auto px-6 py-20 text-center">
          {/* VOLO Icon & Title */}
          <div className="flex items-center justify-center gap-4 mb-6">
            <img 
              src="/assets/volo-logo.png" 
              alt="VOLO Icon" 
              className="w-16 h-16 md:w-20 md:h-20 rounded-full shadow-lg"
            />
            <h1 className="font-display text-5xl md:text-6xl font-bold text-gradient-bg3 leading-tight">
              VOLO
            </h1>
          </div>
          <p className="font-display text-xl md:text-2xl mb-4" style={{ color: 'hsl(var(--bg3-small))' }}>
            Verified Order & Load Optimisation for BG3 Mods
          </p>
          <p className="text-lg mb-8 max-w-3xl mx-auto leading-relaxed" style={{ color: 'hsl(var(--bg3-main))' }}>
            Guided by the spirit of Volo Geddarm, chart a safe course through the wilds of Baldur's Gate 3 modding.
          </p>
          
          <Link href="/import">
            <Button size="lg" className="bg-ornate hover:bg-ornate/90 text-white px-8 py-3 text-lg font-semibold shadow-lg">
              Start Optimising
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
          
          <p className="text-sm mt-4 italic" style={{ color: 'hsl(var(--bg3-main))' }}>
            Behind the scenes, the witty Bard of the Realms is cheering you on.
          </p>
        </div>
      </div>

      {/* What Makes VOLO Unique */}
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h2 className="font-display text-3xl font-bold mb-4" style={{ color: 'hsl(var(--bg3-header))' }}>
            What Makes VOLO Unique
          </h2>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-16">
          <Card className="border-ornate bg-card/50 hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <h3 className="font-display text-xl font-semibold mb-3" style={{ color: 'hsl(var(--bg3-header))' }}>
                A Bardic Guide for Your Mods
              </h3>
              <p className="leading-relaxed" style={{ color: 'hsl(var(--bg3-main))' }}>
                Just as Volo traverses Faerûn chronicling curiosities and chaos, VOLO scans your mod collection, revealing hidden dependencies and untold conflicts. It organises the chaos into a seamless modding journey.
              </p>
            </CardContent>
          </Card>

          <Card className="border-ornate bg-card/50 hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <h3 className="font-display text-xl font-semibold mb-3" style={{ color: 'hsl(var(--bg3-header))' }}>
                Charming Yet Reliable
              </h3>
              <p className="leading-relaxed" style={{ color: 'hsl(var(--bg3-main))' }}>
                Echoing Volo's colourful prose (with its flair and fables), VOLO pairs engaging insight with steadfast algorithms, community wisdom, and master rules.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Key Benefits */}
        <div className="text-center mb-12">
          <h2 className="font-display text-3xl font-bold mb-8" style={{ color: 'hsl(var(--bg3-header))' }}>
            Key Benefits
          </h2>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          <div className="text-center">
            <div className="w-12 h-12 bg-ornate/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="h-6 w-6 text-ornate" />
            </div>
            <h3 className="font-semibold mb-2" style={{ color: 'hsl(var(--bg3-header))' }}>Prevent Crashes and Conflicts</h3>
            <p className="text-sm" style={{ color: 'hsl(var(--bg3-main))' }}>Load order optimised so your game stays running.</p>
          </div>

          <div className="text-center">
            <div className="w-12 h-12 bg-ornate/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Zap className="h-6 w-6 text-ornate" />
            </div>
            <h3 className="font-semibold mb-2" style={{ color: 'hsl(var(--bg3-header))' }}>Dramatic Time-Saver</h3>
            <p className="text-sm" style={{ color: 'hsl(var(--bg3-main))' }}>Automation frees you from manual tweaks.</p>
          </div>

          <div className="text-center">
            <div className="w-12 h-12 bg-ornate/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="h-6 w-6 text-ornate" />
            </div>
            <h3 className="font-semibold mb-2" style={{ color: 'hsl(var(--bg3-header))' }}>Trusted Community Rules</h3>
            <p className="text-sm" style={{ color: 'hsl(var(--bg3-main))' }}>Curated by BG3 modders, modelled on proven methods.</p>
          </div>

          <div className="text-center">
            <div className="w-12 h-12 bg-ornate/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-6 w-6 text-ornate" />
            </div>
            <h3 className="font-semibold mb-2" style={{ color: 'hsl(var(--bg3-header))' }}>Tailored for ALL Users</h3>
            <p className="text-sm" style={{ color: 'hsl(var(--bg3-main))' }}>Whether you're a newcomer or seasoned modder, VOLO adjusts to your needs.</p>
          </div>
        </div>

        {/* Social Proof Placeholder */}
        <div className="hidden" id="social-proof-placeholder">
          {/* Placeholder for future testimonials */}
        </div>

        {/* How It Works */}
        <div className="text-center mb-12">
          <h2 className="font-display text-3xl font-bold mb-8" style={{ color: 'hsl(var(--bg3-header))' }}>
            How It Works
          </h2>
        </div>

        <div className="grid md:grid-cols-4 gap-6 mb-16">
          <div className="text-center">
            <div className="w-16 h-16 bg-ornate text-white rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
              1
            </div>
            <h3 className="font-semibold mb-2" style={{ color: 'hsl(var(--bg3-header))' }}>Upload Your Mod List</h3>
            <p className="text-sm" style={{ color: 'hsl(var(--bg3-main))' }}>Import from BG3MM, JSON, CSV, or text files</p>
          </div>

          <div className="text-center">
            <div className="w-16 h-16 bg-ornate text-white rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
              2
            </div>
            <h3 className="font-semibold mb-2" style={{ color: 'hsl(var(--bg3-header))' }}>VOLO Inspects</h3>
            <p className="text-sm" style={{ color: 'hsl(var(--bg3-main))' }}>Dependencies, conflicts and best-practice rules analysed</p>
          </div>

          <div className="text-center">
            <div className="w-16 h-16 bg-ornate text-white rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
              3
            </div>
            <h3 className="font-semibold mb-2" style={{ color: 'hsl(var(--bg3-header))' }}>View Optimised Order</h3>
            <p className="text-sm" style={{ color: 'hsl(var(--bg3-main))' }}>Clear, conflict-free load order displayed</p>
          </div>

          <div className="text-center">
            <div className="w-16 h-16 bg-ornate text-white rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
              4
            </div>
            <h3 className="font-semibold mb-2" style={{ color: 'hsl(var(--bg3-header))' }}>Export and Use</h3>
            <p className="text-sm" style={{ color: 'hsl(var(--bg3-main))' }}>Compatible with your preferred mod manager</p>
          </div>
        </div>

        {/* Single-Focus CTA */}
        <div className="text-center mb-16">
          <Link href="/import">
            <Button size="lg" className="bg-ornate hover:bg-ornate/90 text-white px-8 py-3 text-lg font-semibold shadow-lg">
              Generate My Optimised Load Order
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>

        {/* FAQ Section */}
        <div className="max-w-3xl mx-auto mb-16">
          <h2 className="font-display text-3xl font-bold text-foreground text-center mb-8">
            Frequently Asked Questions
          </h2>
          
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="account" className="border-ornate/20">
              <AccordionTrigger className="text-left font-semibold">
                Do I need an account?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                No - VOLO works directly in your browser. You can start optimising your mod load order immediately without any registration.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="safety" className="border-ornate/20">
              <AccordionTrigger className="text-left font-semibold">
                Is it safe?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Absolutely - no personal data is stored. Your mod information is processed locally and never transmitted to external servers.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="formats" className="border-ornate/20">
              <AccordionTrigger className="text-left font-semibold">
                Which formats are supported?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                VOLO supports BG3 Mod Manager files, JSON, CSV, and plain text formats. You can import from most popular mod management tools.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="endorsed" className="border-ornate/20">
              <AccordionTrigger className="text-left font-semibold">
                Is this endorsed by the community?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                VOLO bases its rules on community-curated wisdom and follows the proven methodology used by successful load order tools like LOOT.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        {/* Trust-Building Footer */}
        <div className="text-center border-t border-ornate/20 pt-12">
          <div className="grid md:grid-cols-3 gap-6 max-w-2xl mx-auto">
            <div>
              <CheckCircle className="h-8 w-8 text-ornate mx-auto mb-2" />
              <p className="text-sm font-semibold text-foreground mb-1">Lightweight Interface</p>
              <p className="text-xs text-muted-foreground">Focused, distraction-free design</p>
            </div>
            
            <div>
              <Shield className="h-8 w-8 text-ornate mx-auto mb-2" />
              <p className="text-sm font-semibold text-foreground mb-1">No Account Needed</p>
              <p className="text-xs text-muted-foreground">Test-run immediately</p>
            </div>
            
            <div>
              <Users className="h-8 w-8 text-ornate mx-auto mb-2" />
              <p className="text-sm font-semibold text-foreground mb-1">Privacy-Safe</p>
              <p className="text-xs text-muted-foreground">Your mod data stays with you</p>
            </div>
          </div>
        </div>
      </div>

      {/* Support Section */}
      <div className="py-16 bg-card/30">
        <div className="max-w-4xl mx-auto px-6">
          <DonationSection />
        </div>
      </div>
    </div>
  );
}