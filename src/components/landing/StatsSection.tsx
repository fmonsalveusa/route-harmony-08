import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useLandingLang } from "@/contexts/LandingLanguageContext";
import t from "./landingTranslations";

function AnimatedNumber({ value, suffix }: { value: number; suffix: string }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setInView(true);
    }, { threshold: 0.5 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!inView) return;
    const duration = 1600;
    const start = performance.now();
    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.floor(ease * value));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [inView, value]);

  return (
    <div ref={ref} className="text-5xl sm:text-6xl font-extrabold" style={{ background: "linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
      {display.toLocaleString()}{suffix}
    </div>
  );
}

export function StatsSection() {
  const { lang } = useLandingLang();
  const tr = t[lang];

  const stats = [
    { value: 5000, suffix: "+", label: tr.statsLoads },
    { value: 48,   suffix: "",  label: tr.statsStates },
    { value: 98,   suffix: "%", label: tr.statsSatisfaction },
    { value: 24,   suffix: "/7", label: tr.statsSupport },
  ];

  return (
    <section
      className="relative py-20 overflow-hidden"
      style={{ background: "linear-gradient(135deg, #060d1c 0%, #0a1628 100%)" }}
    >
      {/* Top border glow */}
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "linear-gradient(90deg, transparent, #f59e0b40, transparent)" }} />
      <div className="absolute bottom-0 left-0 right-0 h-px" style={{ background: "linear-gradient(90deg, transparent, #2563eb30, transparent)" }} />

      {/* Subtle decorative blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 right-1/4 w-80 h-80 rounded-full blur-3xl opacity-8" style={{ background: "radial-gradient(circle, #f59e0b, transparent 70%)" }} />
        <div className="absolute -bottom-20 left-1/4 w-80 h-80 rounded-full blur-3xl opacity-8" style={{ background: "radial-gradient(circle, #2563eb, transparent 70%)" }} />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.12, duration: 0.6 }}
              className="text-center"
            >
              <AnimatedNumber value={s.value} suffix={s.suffix} />
              <div className="w-8 h-0.5 mx-auto mt-3 mb-3 rounded-full" style={{ background: "linear-gradient(90deg, #f59e0b, #ea580c)" }} />
              <p className="text-white/40 text-xs font-semibold uppercase tracking-widest">{s.label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
