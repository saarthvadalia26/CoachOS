import { CTASection } from "@/components/marketing/CTASection";
import { FeaturesSection } from "@/components/marketing/FeaturesSection";
import { Header } from "@/components/marketing/Header";
import { HeroSection } from "@/components/marketing/HeroSection";
import { ValuePropositionSection } from "@/components/marketing/ValuePropositionSection";

export default function Home() {
  return (
    <div className="min-h-full bg-background text-foreground">
      <Header />
      <main>
        <HeroSection />
        <ValuePropositionSection />
        <FeaturesSection />
        <CTASection />
      </main>
    </div>
  );
}
