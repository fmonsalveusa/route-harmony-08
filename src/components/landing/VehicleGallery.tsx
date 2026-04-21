import { motion } from "framer-motion";
import { ArrowRight, Check, MessageCircle } from "lucide-react";
import boxtruckImg from "@/assets/landing-boxtruck.jpg";
import hotshotImg from "@/assets/landing-hotshot.jpg";
import { useLandingLang } from "@/contexts/LandingLanguageContext";
import t from "./landingTranslations";

export function VehicleGallery() {
  const { lang } = useLandingLang();
  const tr = t[lang];

  const vehicles = [
    {
      img: boxtruckImg,
      badge: "Box Truck",
      badgeColor: "#2563eb",
      title: "26' Box Truck",
      subtitle: lang === "es" ? "Cargas Locales & Regionales" : "Local & Regional Freight",
      desc: lang === "es"
        ? "Ideal para distribución urbana y regional. Capacidad de hasta 10,000 lbs con espacio optimizado para LTL y FTL. Alta demanda, carga constante."
        : "Ideal for urban and regional distribution. Up to 10,000 lbs capacity, optimized for LTL and FTL. High demand, consistent loads.",
      specs: [
        lang === "es" ? "Capacidad: hasta 10,000 lbs" : "Capacity: up to 10,000 lbs",
        lang === "es" ? "Largo interior: 26 pies" : "Interior length: 26 feet",
        lang === "es" ? "Ideal para LTL y FTL" : "Ideal for LTL and FTL",
        lang === "es" ? "Cargas locales y estatales" : "Local and statewide loads",
      ],
      whatsapp: "https://wa.me/19807668815?text=Hola%2C%20me%20interesa%20el%20servicio%20de%20dispatch%20para%20Box%20Truck%2026%27",
      cta: lang === "es" ? "Empezar con Box Truck" : "Start with Box Truck",
      accentBorder: "border-blue-500/30",
      accentGlow: "shadow-blue-900/40",
    },
    {
      img: hotshotImg,
      badge: "Flatbed Hotshot",
      badgeColor: "#f59e0b",
      title: "40' Flatbed Hotshot",
      subtitle: lang === "es" ? "Cargas Especializadas & Time-Critical" : "Specialized & Time-Critical Loads",
      desc: lang === "es"
        ? "La opción premium para cargas urgentes y especializadas. Equipos pesados, materiales de construcción y cargas oversized con entregas express."
        : "The premium option for urgent and specialized loads. Heavy equipment, construction materials and oversized freight with express delivery.",
      specs: [
        lang === "es" ? "Capacidad: hasta 16,000 lbs" : "Capacity: up to 16,000 lbs",
        lang === "es" ? "Plataforma: 40 pies" : "Platform: 40 feet",
        lang === "es" ? "Especialidad: cargas urgentes" : "Specialty: expedited loads",
        lang === "es" ? "Equipos pesados & oversized" : "Heavy equipment & oversized",
      ],
      whatsapp: "https://wa.me/19807668815?text=Hola%2C%20me%20interesa%20el%20servicio%20de%20dispatch%20para%20Flatbed%20Hotshot%2040%27",
      cta: lang === "es" ? "Empezar con Hotshot" : "Start with Hotshot",
      accentBorder: "border-amber-500/30",
      accentGlow: "shadow-amber-900/40",
    },
  ];

  return (
    <section
      id="vehiculos"
      className="py-24 relative overflow-hidden"
      style={{ background: "linear-gradient(180deg, #162540 0%, #1a2f52 100%)" }}
    >
      {/* Top glow line */}
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "linear-gradient(90deg, transparent, #f59e0b30, transparent)" }} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-amber-400 mb-3 block">
            {lang === "es" ? "Nuestra Especialidad" : "Our Specialty"}
          </span>
          <h2 className="text-4xl sm:text-5xl font-extrabold text-white mb-4 tracking-tight">
            {lang === "es" ? "Flota que " : "Fleet We "}
            <span style={{ background: "linear-gradient(90deg, #f59e0b, #ea580c)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              {lang === "es" ? "Manejamos" : "Dispatch"}
            </span>
          </h2>
          <p className="text-white/40 max-w-xl mx-auto text-base">
            {lang === "es"
              ? "Expertos en los dos tipos de vehículo con mayor demanda y rentabilidad en el mercado de carga en EE.UU."
              : "Experts in the two most in-demand and profitable freight vehicle types in the U.S. market."}
          </p>
        </motion.div>

        {/* Vehicle cards */}
        <div className="grid md:grid-cols-2 gap-8">
          {vehicles.map((v, i) => (
            <motion.div
              key={v.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15, duration: 0.6 }}
              className={`group rounded-3xl overflow-hidden border ${v.accentBorder} bg-white/3 backdrop-blur-sm hover:shadow-2xl ${v.accentGlow} transition-all duration-500`}
            >
              {/* Image */}
              <div className="relative overflow-hidden" style={{ height: "260px" }}>
                <img
                  src={v.img}
                  alt={v.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  loading="lazy"
                />
                <div
                  className="absolute inset-0"
                  style={{ background: "linear-gradient(to top, rgba(6,13,28,0.9) 0%, rgba(6,13,28,0.2) 60%, transparent 100%)" }}
                />
                {/* Badge */}
                <div className="absolute top-5 left-5">
                  <span
                    className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest text-white"
                    style={{ background: `${v.badgeColor}cc`, border: `1px solid ${v.badgeColor}` }}
                  >
                    {v.badge}
                  </span>
                </div>
              </div>

              {/* Content */}
              <div className="p-7">
                <h3 className="text-2xl font-extrabold text-white mb-1 tracking-tight">{v.title}</h3>
                <p className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-4">{v.subtitle}</p>
                <p className="text-white/55 text-sm leading-relaxed mb-6">{v.desc}</p>

                {/* Specs */}
                <ul className="space-y-2 mb-7">
                  {v.specs.map((spec) => (
                    <li key={spec} className="flex items-center gap-2.5 text-sm text-white/60">
                      <Check size={13} className="shrink-0" style={{ color: v.badgeColor }} />
                      {spec}
                    </li>
                  ))}
                </ul>

                {/* CTA buttons */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <a
                    href="#onboarding"
                    className="flex-1 inline-flex items-center justify-center gap-2 font-bold px-5 py-3 rounded-xl text-sm text-white transition-all hover:-translate-y-0.5"
                    style={{ background: `linear-gradient(135deg, ${v.badgeColor}, ${i === 0 ? "#1d4ed8" : "#ea580c"})` }}
                  >
                    {v.cta}
                    <ArrowRight size={15} />
                  </a>
                  <a
                    href={v.whatsapp}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 border border-white/15 text-white/60 hover:text-white hover:border-white/30 font-semibold px-5 py-3 rounded-xl text-sm transition-all"
                  >
                    <MessageCircle size={15} />
                    WhatsApp
                  </a>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mt-14"
        >
          <p className="text-white/35 text-sm mb-4">
            {lang === "es" ? "¿Tienes un camión diferente? También trabajamos con Dry Van, Reefer y Flatbed 53'." : "Have a different truck? We also work with Dry Van, Reefer and 53' Flatbed."}
          </p>
          <a
            href="#meeting"
            className="inline-flex items-center gap-2 text-amber-400 hover:text-amber-300 font-semibold text-sm transition-colors"
          >
            {lang === "es" ? "Consultar para otro tipo de vehículo" : "Inquire about another vehicle type"}
            <ArrowRight size={14} />
          </a>
        </motion.div>
      </div>
    </section>
  );
}
