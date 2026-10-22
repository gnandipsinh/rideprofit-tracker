import { useState, useEffect } from "react";
import { LandingNavbar } from "./components/LandingNavbar";
import { HeroSection } from "./components/HeroSection";
import { FeaturesSection } from "./components/FeaturesSection";
import { HowItWorksSection } from "./components/HowItWorksSection";
import { StatsStrip } from "./components/StatsStrip";
import { TestimonialsSection } from "./components/TestimonialsSection";
import { PricingSection } from "./components/PricingSection";
import { FaqSection } from "./components/FaqSection";
import { CtaBanner } from "./components/CtaBanner";
import { LandingFooter } from "./components/LandingFooter";

export function LandingPage() {
  const [activeSection, setActiveSection] = useState("home");

  useEffect(() => {
    const handleScroll = () => {
      const sections = ["home", "features", "how-it-works", "reviews", "pricing", "faq"];
      for (const section of sections) {
        const el = document.getElementById(section);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 160 && rect.bottom >= 120) {
            setActiveSection(section);
            break;
          }
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="landing-root min-h-screen selection:bg-cyan-500/30 selection:text-white overflow-x-hidden w-full relative">
      {/* Top Navigation */}
      <LandingNavbar activeSection={activeSection} />

      <main className="pt-20">
        {/* Hero Section */}
        <HeroSection />

        {/* Features Section */}
        <FeaturesSection />

        {/* How It Works Section */}
        <HowItWorksSection />

        {/* Statistics Strip */}
        <StatsStrip />

        {/* Testimonials Section */}
        <TestimonialsSection />

        {/* Pricing Section */}
        <PricingSection />

        {/* Bottom CTA Banner */}
        <CtaBanner />

        {/* FAQ Section */}
        <FaqSection />
      </main>

      {/* Footer immediately following FAQ */}
      <LandingFooter />
    </div>
  );
}
