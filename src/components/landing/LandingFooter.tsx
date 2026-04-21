import { MessageCircle, Mail, Phone, MapPin, ArrowRight, Truck, Package } from "lucide-react";
import logo from "@/assets/dispatch-up-logo.png";
import { useLandingLang } from "@/contexts/LandingLanguageContext";
import t from "./landingTranslations";

export function LandingFooter() {
  const { lang } = useLandingLang();
  const tr = t[lang];

  const services = lang === "es"
    ? ["Dispatch Box Truck 26'", "Dispatch Flatbed Hotshot 40'", "Leasing de MC#", "TMS – Sistema de Gestión", "Tracking en Tiempo Real", "Asesoría de Negocio", "Permisos & Cumplimiento", "Curso para Dispatchers"]
    : ["Box Truck 26' Dispatch", "Flatbed Hotshot 40' Dispatch", "MC# Leasing", "TMS – Management System", "Real-Time Tracking", "Business Advisory", "Permits & Compliance", "Dispatcher Training Course"];

  const vehicles = [
    { icon: Package, label: "Box Truck 26'", color: "#2563eb" },
    { icon: Truck,   label: "Flatbed Hotshot 40'", color: "#f59e0b" },
  ];

  return (
    <footer
      id="contacto"
      style={{ background: "linear-gradient(180deg, #060d1c 0%, #040a18 100%)" }}
      className="border-t border-white/6"
    >
      {/* ── CTA Banner ── */}
      <div
        className="border-b border-white/6"
        style={{ background: "linear-gradient(135deg, #0d1a35 0%, #111d38 100%)" }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 text-center">
          <h3 className="text-2xl sm:text-3xl font-extrabold text-white mb-2">
            {tr.footerCta}{" "}
            <span style={{ background: "linear-gradient(90deg, #f59e0b, #ea580c)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Dispatch Up
            </span>
          </h3>
          <p className="text-white/40 text-sm mb-7">
            {lang === "es"
              ? "Box Truck 26' · Flatbed Hotshot 40' · Charlotte, NC"
              : "Box Truck 26' · Flatbed Hotshot 40' · Charlotte, NC"}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="#onboarding"
              className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold px-8 py-3.5 rounded-xl text-sm transition-all shadow-lg shadow-blue-700/20 hover:-translate-y-0.5"
            >
              {tr.footerCtaBtn}
              <ArrowRight size={16} />
            </a>
            <a
              href="#meeting"
              className="inline-flex items-center justify-center gap-2 border border-amber-400/40 text-amber-400 hover:bg-amber-400/10 font-bold px-8 py-3.5 rounded-xl text-sm transition-all"
            >
              {lang === "es" ? "Agendar Reunión" : "Schedule Meeting"}
            </a>
          </div>
        </div>
      </div>

      {/* ── Main footer columns ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid md:grid-cols-4 gap-10">

          {/* Brand */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-3 mb-5">
              <img src={logo} alt="Dispatch Up" className="h-10 w-10 rounded-xl object-cover" />
              <span className="font-extrabold text-lg text-white tracking-tight">Dispatch Up</span>
            </div>
            <p className="text-sm leading-relaxed text-white/40 mb-6">{tr.footerDesc}</p>

            {/* Vehicle types */}
            <div className="space-y-2">
              {vehicles.map((v) => (
                <div key={v.label} className="flex items-center gap-2">
                  <v.icon size={14} style={{ color: v.color }} />
                  <span className="text-xs text-white/40 font-medium">{v.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Services */}
          <div className="md:col-span-2">
            <h4 className="font-bold text-white/80 mb-5 text-sm uppercase tracking-wider">
              {tr.footerServices}
            </h4>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2">
              {services.map((s) => (
                <span key={s} className="text-sm text-white/40 hover:text-white/70 transition-colors cursor-default">
                  {s}
                </span>
              ))}
            </div>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-bold text-white/80 mb-5 text-sm uppercase tracking-wider">
              {tr.footerContact}
            </h4>
            <ul className="space-y-4">
              <li>
                <a
                  href="https://wa.me/19807668815?text=Hola,%20me%20interesa%20información%20sobre%20sus%20servicios"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 text-sm text-white/40 hover:text-amber-400 transition-colors group"
                >
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-amber-400/10 transition-colors shrink-0">
                    <MessageCircle size={14} className="text-amber-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-white/60">WhatsApp</p>
                    <p className="text-xs">+1 (980) 766-8815</p>
                  </div>
                </a>
              </li>
              <li>
                <a
                  href="tel:+19807668815"
                  className="flex items-center gap-3 text-sm text-white/40 hover:text-white/70 transition-colors group"
                >
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                    <Phone size={14} className="text-white/30" />
                  </div>
                  <div>
                    <p className="font-semibold text-white/60">{lang === "es" ? "Teléfono" : "Phone"}</p>
                    <p className="text-xs">+1 (980) 766-8815</p>
                  </div>
                </a>
              </li>
              <li className="flex items-center gap-3 text-sm text-white/40">
                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                  <MapPin size={14} className="text-white/30" />
                </div>
                <div>
                  <p className="font-semibold text-white/60">Charlotte, NC</p>
                  <p className="text-xs">{lang === "es" ? "Sirviendo 48 Estados" : "Serving 48 States"}</p>
                </div>
              </li>
              <li>
                <a
                  href="mailto:info@dispatchup.com"
                  className="flex items-center gap-3 text-sm text-white/40 hover:text-white/70 transition-colors group"
                >
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                    <Mail size={14} className="text-white/30" />
                  </div>
                  <div>
                    <p className="font-semibold text-white/60">Email</p>
                    <p className="text-xs">info@dispatchup.com</p>
                  </div>
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* ── Bottom bar ── */}
        <div className="border-t border-white/6 mt-12 pt-7 flex flex-col sm:flex-row justify-between items-center gap-4">
          <span className="text-xs text-white/25">
            © {new Date().getFullYear()} Dispatch Up · Charlotte, NC · {tr.footerRights}
          </span>
          <div className="flex items-center gap-6">
            <a href="/privacy" className="text-xs text-white/25 hover:text-white/50 transition-colors">
              {tr.footerPrivacy}
            </a>
            <a href="/auth" className="text-xs text-white/25 hover:text-white/50 transition-colors">
              {lang === "es" ? "Acceso Clientes" : "Client Login"}
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
