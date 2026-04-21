import { motion } from "framer-motion";
import { ArrowRight, CalendarIcon, MapPin, Phone, Shield, TrendingUp, Clock } from "lucide-react";
import heroImg from "@/assets/landing-hero.jpg";
import boxtruckImg from "@/assets/landing-boxtruck.jpg";
import hotshotImg from "@/assets/landing-hotshot.jpg";
import { useLandingLang } from "@/contexts/LandingLanguageContext";
import t from "./landingTranslations";

export function HeroSection() {
  const { lang } = useLandingLang();
  const tr = t[lang];

  const trust = [
    { icon: Shield,     text: lang === "es" ? "Dispatch Confiable" : "Reliable Dispatch" },
    { icon: TrendingUp, text: lang === "es" ? "Máxima Rentabilidad" : "Top Earnings" },
    { icon: Clock,      text: "24 / 7" },
  ];

  return (
    <section
      className="relative min-h-screen flex items-center overflow-hidden mt-16"
      style={{ background: "linear-gradient(135deg, #060d1c 0%, #0a1628 60%, #0d1f3a 100%)" }}
    >
      {/* ── Background hero image ── */}
      <div className="absolute inset-0 pointer-events-none">
        <img
          src={heroImg}
          alt="Dispatch Up Fleet"
          className="w-full h-full object-cover object-center opacity-20"
        />
        {/* Dark gradient overlay left→right so left stays readable */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(105deg, rgba(6,13,28,0.97) 0%, rgba(6,13,28,0.80) 45%, rgba(6,13,28,0.55) 100%)",
          }}
        />
        {/* Ambient glow blobs */}
        <div
          className="absolute top-1/3 right-1/4 w-[480px] h-[480px] rounded-full blur-3xl opacity-10"
          style={{ background: "radial-gradient(circle, #2563eb, transparent 70%)" }}
        />
        <div
          className="absolute bottom-1/4 left-1/4 w-72 h-72 rounded-full blur-3xl opacity-10"
          style={{ background: "radial-gradient(circle, #f59e0b, transparent 70%)" }}
        />
      </div>

      {/* ── Content ── */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32 w-full">
        <div className="grid lg:grid-cols-2 gap-14 items-center">

          {/* ── Left: headline + CTAs ── */}
          <div>
            {/* Location badge */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 bg-white/5 border border-white/10 text-white/60 px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide mb-7"
            >
              <MapPin size={13} className="text-amber-400 shrink-0" />
              Charlotte, NC &nbsp;·&nbsp; {lang === "es" ? "Sirviendo 48 Estados" : "Serving 48 States"}
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1 }}
              className="text-5xl sm:text-6xl lg:text-[4.5rem] font-extrabold text-white leading-[1.05] mb-6 tracking-tight"
            >
              {lang === "es" ? "Dispatch" : "Professional"}&nbsp;
              <span
                style={{
                  background: "linear-gradient(90deg, #f59e0b 0%, #ea580c 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                {lang === "es" ? "Profesional" : "Dispatch"}
              </span>
              <br />
              {lang === "es" ? "para tu Negocio" : "for Your Business"}
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="text-base sm:text-lg text-white/55 mb-10 leading-relaxed max-w-lg"
            >
              {lang === "es"
                ? "Especialistas en Box Truck 26' y Flatbed Hotshot 40'. Dispatch, Leasing MC#, TMS y asesoría completa para impulsar tu negocio de transporte en los 48 estados."
                : "Specialists in Box Truck 26' and Flatbed Hotshot 40'. Dispatch, MC# Leasing, TMS and full advisory to grow your trucking business across all 48 states."}
            </motion.p>

            {/* CTA buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-4 mb-10"
            >
              <a
                href="#meeting"
                className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold px-8 py-4 rounded-xl text-base transition-all shadow-lg shadow-blue-700/30 hover:-translate-y-0.5"
              >
                <CalendarIcon size={18} />
                {lang === "es" ? "Agendar Reunión" : "Schedule Meeting"}
              </a>
              <a
                href="#onboarding"
                className="inline-flex items-center justify-center gap-2 border border-amber-400/40 text-amber-400 hover:bg-amber-400/10 font-bold px-8 py-4 rounded-xl text-base transition-all hover:-translate-y-0.5"
              >
                {lang === "es" ? "Registrar Driver" : "Register Driver"}
                <ArrowRight size={18} />
              </a>
            </motion.div>

            {/* Trust items */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="flex flex-wrap gap-4"
            >
              {trust.map((item) => (
                <div
                  key={item.text}
                  className="flex items-center gap-2 bg-white/4 border border-white/8 rounded-lg px-3 py-2"
                >
                  <item.icon size={14} className="text-amber-400 shrink-0" />
                  <span className="text-white/60 text-xs font-semibold">{item.text}</span>
                </div>
              ))}
              <a
                href="https://wa.me/19807668815"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 bg-white/4 border border-white/8 rounded-lg px-3 py-2 hover:border-amber-400/30 transition-colors"
              >
                <Phone size={14} className="text-amber-400 shrink-0" />
                <span className="text-white/60 text-xs font-semibold">(980) 766-8815</span>
              </a>
            </motion.div>
          </div>

          {/* ── Right: vehicle cards ── */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.9, delay: 0.35 }}
            className="hidden lg:flex flex-col gap-5"
          >
            {/* Box Truck card */}
            <a href="#onboarding" className="relative rounded-2xl overflow-hidden group cursor-pointer block" style={{ height: "210px" }}>
              <img
                src={boxtruckImg}
                alt="Box Truck 26'"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
              />
              <div
                className="absolute inset-0"
                style={{ background: "linear-gradient(to right, rgba(6,13,28,0.88) 0%, rgba(6,13,28,0.3) 60%, transparent 100%)" }}
              />
              <div className="absolute inset-0 p-7 flex flex-col justify-center">
                <span className="inline-flex items-center gap-1.5 bg-blue-500/25 border border-blue-400/40 text-blue-300 px-3 py-1 rounded-full text-[11px] font-bold tracking-widest uppercase w-fit mb-3">
                  Box Truck
                </span>
                <h3 className="text-3xl font-extrabold text-white tracking-tight">26' Box Truck</h3>
                <p className="text-white/55 text-sm mt-1.5">
                  {lang === "es" ? "Cargas locales · Regionales · LTL / FTL" : "Local · Regional · LTL / FTL Loads"}
                </p>
              </div>
              {/* Hover border glow */}
              <div className="absolute inset-0 rounded-2xl border border-blue-400/0 group-hover:border-blue-400/30 transition-colors duration-300" />
            </a>

            {/* Hotshot card */}
            <a href="#onboarding" className="relative rounded-2xl overflow-hidden group cursor-pointer block" style={{ height: "210px" }}>
              <img
                src={hotshotImg}
                alt="Flatbed Hotshot 40'"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
              />
              <div
                className="absolute inset-0"
                style={{ background: "linear-gradient(to right, rgba(6,13,28,0.88) 0%, rgba(6,13,28,0.3) 60%, transparent 100%)" }}
              />
              <div className="absolute inset-0 p-7 flex flex-col justify-center">
                <span className="inline-flex items-center gap-1.5 bg-amber-500/25 border border-amber-400/40 text-amber-300 px-3 py-1 rounded-full text-[11px] font-bold tracking-widest uppercase w-fit mb-3">
                  Flatbed Hotshot
                </span>
                <h3 className="text-3xl font-extrabold text-white tracking-tight">40' Flatbed Hotshot</h3>
                <p className="text-white/55 text-sm mt-1.5">
                  {lang === "es" ? "Cargas especializadas · Time-critical · OD" : "Specialized · Time-critical · Oversized"}
                </p>
              </div>
              <div className="absolute inset-0 rounded-2xl border border-amber-400/0 group-hover:border-amber-400/30 transition-colors duration-300" />
            </a>
          </motion.div>

        </div>
      </div>

      {/* ── Scroll indicator ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.4 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10"
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
