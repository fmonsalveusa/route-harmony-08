import { MessageCircle, Mail, Phone, ArrowRight } from "lucide-react";
import logo from "@/assets/logo.png";
import { useLandingLang } from "@/contexts/LandingLanguageContext";
import t from "./landingTranslations";

export function LandingFooter() {
  const { lang } = useLandingLang();
  const tr = t[lang];

  return (
    <footer id="contacto" className="bg-secondary/60 text-foreground border-t border-border">
      <div className="border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
          <h3 className="text-2xl sm:text-3xl font-bold mb-4">
            {tr.footerCta} <span className="text-accent">Dispatch Up</span>
          </h3>
          <a href="#onboarding" className="inline-flex items-center gap-2 bg-accent text-accent-foreground px-8 py-3 rounded-lg font-bold hover:brightness-110 transition">
            {tr.footerCtaBtn} <ArrowRight size={18} />
          </a>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid md:grid-cols-3 gap-10">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <img src={logo} alt="Dispatch Up" className="h-8 w-auto" />
              <span className="font-bold text-lg">Dispatch Up</span>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">{tr.footerDesc}</p>
          </div>

          <div>
            <h4 className="font-semibold mb-4">{tr.footerServices}</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {tr.footerServicesList.map((s) => (<li key={s}>{s}</li>))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">{tr.footerContact}</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li>
                <a href="https://wa.me/19807668815?text=Hola,%20me%20interesa%20información%20sobre%20sus%20servicios" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-accent transition-colors">
                  <MessageCircle size={16} /> +1 (980) 766-8815
                </a>
              </li>
              <li className="flex items-center gap-2"><Phone size={16} /> +1 (980) 766-8815</li>
              <li className="flex items-center gap-2"><Mail size={16} /> info@loadup.com</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-border mt-10 pt-6 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} Dispatch Up TMS. {tr.footerRights}</span>
          <a href="/privacy" className="hover:text-accent transition-colors">{tr.footerPrivacy}</a>
        </div>
      </div>
    </footer>
  );
}
