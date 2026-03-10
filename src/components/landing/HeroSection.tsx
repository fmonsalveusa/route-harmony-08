import { motion } from "framer-motion";
import { ArrowRight, MessageCircle } from "lucide-react";
import heroImg from "@/assets/landing-hero.jpg";

export function HeroSection() {
  return (
    <section className="relative min-h-[90vh] flex items-center overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <img src={heroImg} alt="Fleet" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-[hsl(214,52%,12%)]/95 via-[hsl(214,52%,12%)]/75 to-transparent" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="max-w-2xl"
        >
          <span className="inline-block bg-accent/20 text-accent px-3 py-1 rounded-full text-sm font-semibold mb-6 border border-accent/30">
            Servicios de Dispatching & Transporte
          </span>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight mb-6">
            Tu Socio en el <span className="text-accent">Camino al Éxito</span>
          </h1>
          <p className="text-lg text-white/70 mb-8 leading-relaxed max-w-xl">
            Dispatch profesional, leasing de MC#, tracking en tiempo real y asesoría completa para tu negocio de transporte. Box Trucks & Hotshots.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <a
              href="#onboarding"
              className="inline-flex items-center justify-center gap-2 bg-green-500 text-white px-6 py-3 rounded-lg font-bold text-base hover:bg-green-600 transition shadow-lg shadow-green-500/25"
            >
              🚛 Regístrate como Driver <ArrowRight size={18} />
            </a>
            <a
              href="#servicios"
              className="inline-flex items-center justify-center gap-2 bg-accent text-accent-foreground px-6 py-3 rounded-lg font-semibold text-base hover:brightness-110 transition shadow-lg shadow-accent/25"
            >
              Conoce Nuestros Servicios <ArrowRight size={18} />
            </a>
            <a
              href="https://wa.me/19807668815?text=Hola,%20me%20interesa%20información%20sobre%20sus%20servicios"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-white/10 text-white px-6 py-3 rounded-lg font-semibold text-base hover:bg-white/20 transition border border-white/20"
            >
              <MessageCircle size={18} /> Contáctanos por WhatsApp
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
