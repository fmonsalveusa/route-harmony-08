import { useEffect } from "react";
import { useTheme } from "next-themes";
import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { HeroSection } from "@/components/landing/HeroSection";
import { StatsSection } from "@/components/landing/StatsSection";
import { TestimonialsSection } from "@/components/landing/TestimonialsSection";
import { ServicesSection } from "@/components/landing/ServicesSection";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { VehicleGallery } from "@/components/landing/VehicleGallery";
import { MeetingSection } from "@/components/landing/MeetingSection";
import { OnboardingSection } from "@/components/landing/OnboardingSection";
import { FAQSection } from "@/components/landing/FAQSection";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { AIChatWidget } from "@/components/landing/AIChatWidget";
import { MobileStickyBar } from "@/components/landing/MobileStickyBar";
import { LandingLanguageProvider } from "@/contexts/LandingLanguageContext";

export default function Landing() {
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    const prev = theme;
    setTheme("light");
    return () => {
      if (prev && prev !== "light") setTheme(prev);
    };
  }, []);

  return (
    <LandingLanguageProvider>
      <div className="min-h-screen bg-background">
        <LandingNavbar />
        <HeroSection />
        <StatsSection />
        <HowItWorks />
        <ServicesSection />
        <TestimonialsSection />
        <VehicleGallery />
        <MeetingSection />
        <OnboardingSection />
        <FAQSection />
        <LandingFooter />
        <MobileStickyBar />
        <AIChatWidget />
      </div>
    </LandingLanguageProvider>
  );
}
