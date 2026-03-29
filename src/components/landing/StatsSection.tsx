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
    const duration = 1500;
    const start = performance.now();
    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      setDisplay(Math.floor(progress * value));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [inView, value]);

  return (
    <div ref={ref} className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white">
      {display.toLocaleString()}{suffix}
    </div>
  );
}

export function StatsSection() {
  const { lang } = useLandingLang();
  const tr = t[lang];

  const stats = [
    { value: 5000, suffix: "+", label: tr.statsLoads },
    { value: 48, suffix: "", label: tr.statsStates },
    { value: 98, suffix: "%", label: tr.statsSatisfaction },
    { value: 24, suffix: "/7", label: tr.statsSupport },
  ];

  return (
    <section className="relative py-20 overflow-hidden" style={{ background: "linear-gradient(135deg, hsl(214, 52%, 18%) 0%, hsl(214, 52%, 10%) 100%)" }}>
      {/* Subtle decorative elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-[hsl(28,92%,52%)]/5 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-[hsl(217,78%,50%)]/5 blur-3xl" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="text-center"
            >
              <AnimatedNumber value={s.value} suffix={s.suffix} />
              <p className="text-white/50 text-sm font-medium mt-3 uppercase tracking-wider">{s.label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
