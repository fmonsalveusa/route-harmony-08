import { Phone, MessageCircle } from "lucide-react";
import { useLandingLang } from "@/contexts/LandingLanguageContext";

export function MobileStickyBar() {
  const { lang } = useLandingLang();

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-card border-t shadow-[0_-4px_20px_rgba(0,0,0,0.1)] safe-area-pb">
      <div className="grid grid-cols-2 divide-x divide-border">
        <a
          href="tel:+19807668815"
          className="flex items-center justify-center gap-2 py-3.5 text-foreground font-semibold text-sm hover:bg-muted transition-colors"
        >
          <Phone size={18} className="text-accent" />
          {lang === "es" ? "Llamar" : "Call"}
        </a>
        <a
          href="https://wa.me/19807668815"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 py-3.5 text-white font-semibold text-sm bg-[hsl(152,60%,40%)] hover:bg-[hsl(152,60%,35%)] transition-colors"
        >
          <MessageCircle size={18} />
          WhatsApp
        </a>
      </div>
    </div>
  );
}
