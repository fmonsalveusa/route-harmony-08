import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { HeroSection } from "@/components/landing/HeroSection";
import { ServicesSection } from "@/components/landing/ServicesSection";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { OnboardingSection } from "@/components/landing/OnboardingSection";
import { VehicleGallery } from "@/components/landing/VehicleGallery";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { AIChatWidget } from "@/components/landing/AIChatWidget";

export default function Landing() {
  return (
    <div className="min-h-screen">
      <LandingNavbar />
      <HeroSection />
      <ServicesSection />
      <HowItWorks />
      <VehicleGallery />
      <OnboardingSection />
      <LandingFooter />
      <AIChatWidget />
    </div>
  );
}
