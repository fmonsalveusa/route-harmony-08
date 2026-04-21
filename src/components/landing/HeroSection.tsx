import { motion } from "framer-motion";
import { ArrowRight, CalendarIcon, MapPin, Phone, Shield, TrendingUp, Clock } from "lucide-react";
import heroImg from "@/assets/landing-hero.jpg";
import boxtruckImg from "@/assets/landing-boxtruck.jpg";
import hotshotImg from "@/assets/landing-hotshot.jpg";
import { useLandingLang } from "@/contexts/LandingLanguageContext";

export function HeroSection() {
  const { lang } = useLandingLang();

  const trust = [
    { icon: Shield,     text: lang === "es" ? "Dispatch Confiable" : "Reliable Dispatch" },
    { icon: TrendingUp, text: lang === "es" ? "Máxima Rentabilidad" : "Top Earnings" },
    { icon: Clock,      text: "24 / 7" },
  ];

  const vehicles = [
    {
      img: boxtruckImg,
      badge: "Box Truck 26'",
      badgeColor: "#2563eb",
      sub: lang === "es" ? "Local · Regional · LTL / FTL" : "Local · Regional · LTL / FTL",
    },
    {
      img: hotshotImg,
      badge: "Flatbed Hotshot 40'",
      badgeColor: "#f59e0b",
      sub: lang === "es" ? "Especializado · Time-Critical · OD" : "Specialized · Time-Critical · OD",
    },
  ];

  return (
    <section
      className="relative overflow-hidden mt-16"
      style={{ background: "linear-gradient(135deg, #1a2f52 0%, #1e3a6e 60%, #1a3060 100%)" }}
    >
      {/* ── Background hero image ── */}
      <div className="absolute inset-0 pointer-events-none">
        <img
          src={heroImg}
          alt="Dispatch Up Fleet"
          className="w-full h-full object-cover object-center opacity-55"
        />
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(180deg, rgba(20,40,80,0.55) 0%, rgba(20,40,80,0.40) 50%, rgba(20,40,80,0.65) 100%)" }}
        />
        {/* Ambient glow */}
        <div className="absolute top-0 right-1/4 w-[500px] h-[500px] rounded-full blur-3xl opacity-8 pointer-events-none"
          style={{ background: "radial-gradient(circle, #2563eb, transparent 70%)" }} />
        <div className="absolute bottom-0 left-1/4 w-72 h-72 rounded-full blur-3xl opacity-8 pointer-events-none"
          style={{ background: "radial-gradient(circle, #f59e0b, transparent 70%)" }} />
      </div>

      {/* ── Content ── */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-16">

        {/* ── Row 1: Vehicle cards side by side ── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="grid grid-cols-2 gap-4 mb-12"
        >
          {vehicles.map((v, i) => (
            <a
              key={v.badge}
              href="#onboarding"
              className="relative rounded-2xl overflow-hidden group block"
              style={{ height: "200px" }}
            >
              <img
                src={v.img}
                alt={v.badge}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
              />
              {/* Gradient overlay */}
              <div
                className="absolute inset-0"
                style={{ background: "linear-gradient(to top, rgba(6,13,28,0.92) 0%, rgba(6,13,28,0.45) 55%, rgba(6,13,28,0.15) 100%)" }}
              />
              {/* Border glow on hover */}
              <div
                className="absolute inset-0 rounded-2xl border transition-colors duration-300"
                style={{ borderColor: `${v.badgeColor}00` }}
              />
              {/* Text overlay — bottom */}
              <div className="absolute bottom-0 left-0 right-0 p-5">
                <span
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest text-white mb-2"
                  style={{ background: `${v.badgeColor}cc`, border: `1px solid ${v.badgeColor}` }}
                >
                  {v.badge}
                </span>
                <p className="text-white/50 text-xs">{v.sub}</p>
              </div>
            </a>
          ))}
        </motion.div>

        {/* ── Row 2: Location badge ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="flex justify-center mb-5"
        >
          <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 text-white/55 px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide">
            <MapPin size={13} className="text-amber-400 shrink-0" />
            Charlotte, NC &nbsp;·&nbsp; {lang === "es" ? "Sirviendo 48 Estados" : "Serving 48 States"}
          </div>
        </motion.div>

        {/* ── Row 3: Headline ── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="text-center mb-5"
        >
          <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-extrabold text-white leading-[1.06] tracking-tight">
            {lang === "es" ? "Dispatch" : "Professional"}&nbsp;
            <span style={{ background: "linear-gradient(90deg, #f59e0b 0%, #ea580c 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              {lang === "es" ? "Profesional" : "Dispatch"}
            </span>
            <br className="hidden sm:block" />
            {" "}{lang === "es" ? "para tu Negocio de Transporte" : "for Your Trucking Business"}
          </h1>
        </motion.div>

        {/* ── Row 4: Subtitle ── */}
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="text-center text-white/50 text-base sm:text-lg leading-relaxed max-w-2xl mx-auto mb-10"
        >
          {lang === "es"
            ? "Dispatch, Leasing MC#, TMS y asesoría completa para Box Truck 26' y Flatbed Hotshot 40'. Carga constante en los 48 estados."
            : "Dispatch, MC# Leasing, TMS and full advisory for Box Truck 26' and Flatbed Hotshot 40'. Consistent loads across all 48 states."}
        </motion.p>

        {/* ── Row 5: CTA buttons ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.38 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10"
        >
          <a
            href="#meeting"
            className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold px-8 py-4 rounded-xl text-base transition-all shadow-lg shadow-blue-700/30 hover:-translate-y-0.5 w-full sm:w-auto"
          >
            <CalendarIcon size={18} />
            {lang === "es" ? "Agendar Reunión" : "Schedule Meeting"}
          </a>
          <a
            href="#onboarding"
            className="inline-flex items-center justify-center gap-2 bg-amber-400 hover:bg-amber-300 text-white font-bold px-8 py-4 rounded-xl text-base transition-all hover:-translate-y-0.5 w-full sm:w-auto shadow-lg shadow-amber-600/30"
          >
            {lang === "es" ? "Registrar Driver" : "Register Driver"}
            <ArrowRight size={18} />
          </a>
        </motion.div>

        {/* ── Row 6: Trust badges + phone ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="flex flex-wrap items-center justify-center gap-3"
        >
          {trust.map((item) => (
            <div key={item.text} className="flex items-center gap-2 bg-white/4 border border-white/8 rounded-lg px-3 py-2">
              <item.icon size={13} className="text-amber-400 shrink-0" />
              <span className="text-white/55 text-xs font-semibold">{item.text}</span>
            </div>
          ))}
          <a
            href="https://wa.me/19807668815"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-white/4 border border-white/8 rounded-lg px-3 py-2 hover:border-amber-400/30 transition-colors"
          >
            <Phone size={13} className="text-amber-400 shrink-0" />
            <span className="text-white/55 text-xs font-semibold">(980) 766-8815</span>
          </a>
        </motion.div>

      </div>

      {/* ── Scroll indicator ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
        className="relative z-10 flex justify-center pb-8"
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="w-6 h-10 rounded-full border-2 border-white/15 flex items-start justify-center p-1.5"
        >
          <div className="w-1.5 h-1.5 rounded-full bg-amber-400/50" />
        </motion.div>
      </motion.div>
    </section>
  );
}
