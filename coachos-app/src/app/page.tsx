import type { Metadata } from "next";

import { CTASection } from "@/components/marketing/CTASection";
import { FAQSection } from "@/components/marketing/FAQSection";
import { FeaturesSection } from "@/components/marketing/FeaturesSection";
import { Footer } from "@/components/marketing/Footer";
import { Header } from "@/components/marketing/Header";
import { HeroSection } from "@/components/marketing/HeroSection";
import { OperationsFitSection } from "@/components/marketing/OperationsFitSection";
import { PricingSection } from "@/components/marketing/PricingSection";
import { ValuePropositionSection } from "@/components/marketing/ValuePropositionSection";

export const metadata: Metadata = {
  title: {
    absolute: "CoachOS",
  },
};

export default function Home() {
  return (
    <div className="min-h-full bg-background text-foreground">
      <Header />
      <main>
        <HeroSection />
        <ValuePropositionSection />
        <FeaturesSection />
        <OperationsFitSection />
        <PricingSection />
        <FAQSection />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
}
