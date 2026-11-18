import { Navbar } from "@/components/marketing/Navbar";
import { Hero } from "@/components/marketing/Hero";
import { ThreePersonas } from "@/components/marketing/ThreePersonas";
import { FeatureGrid } from "@/components/marketing/FeatureGrid";
import { FusionSection } from "@/components/marketing/FusionSection";
import { StatsBand } from "@/components/marketing/StatsBand";
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { Testimonials } from "@/components/marketing/Testimonials";
import { TrustBand } from "@/components/marketing/TrustBand";
import { FinalCtaFooter } from "@/components/marketing/FinalCtaFooter";

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <ThreePersonas />
        <FeatureGrid />
        <FusionSection />
        <StatsBand />
        <HowItWorks />
        <Testimonials />
        <TrustBand />
      </main>
      <FinalCtaFooter />
    </>
  );
}
