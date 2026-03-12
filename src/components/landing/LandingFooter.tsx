import { MessageCircle, Mail, Phone, ArrowRight } from "lucide-react";
import logo from "@/assets/logo.png";

export function LandingFooter() {
  return (
    <footer id="contacto" className="bg-secondary/60 text-foreground border-t border-border">
      {/* CTA Banner */}
      <div className="border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
          <h3 className="text-2xl sm:text-3xl font-bold mb-4">
            No manejes vacío, maneja con <span className="text-accent">Dispatch Up</span>
          </h3>
          <a
            href="#onboarding"
            className="inline-flex items-center gap-2 bg-accent text-accent-foreground px-8 py-3 rounded-lg font-bold hover:brightness-110 transition"
          >
            Comienza Hoy <ArrowRight size={18} />
          </a>
        </div>
      </div>

      {/* Footer content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid md:grid-cols-3 gap-10">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <img src={logo} alt="Dispatch Up" className="h-8 w-auto" />
              <span className="font-bold text-lg">Dispatch Up</span>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Tu socio de confianza en servicios de dispatching, leasing y transporte de carga en Estados Unidos.
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Servicios</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>Dispatching para MC# propio</li>
              <li>Leasing bajo nuestro MC#</li>
              <li>Curso de Dispatcher</li>
              <li>Tracking Up App</li>
              <li>Asesoría Personal</li>
              <li>Trámite de Permisos</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Contacto</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li>
                <a
                  href="https://wa.me/19807668815?text=Hola,%20me%20interesa%20información%20sobre%20sus%20servicios"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 hover:text-accent transition-colors"
                >
                  <MessageCircle size={16} /> +1 (980) 766-8815
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Phone size={16} /> +1 (980) 766-8815
              </li>
              <li className="flex items-center gap-2">
                <Mail size={16} /> info@loadup.com
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-border mt-10 pt-6 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} Dispatch Up TMS. Todos los derechos reservados.</span>
          <a href="/privacy" className="hover:text-accent transition-colors">Política de Privacidad</a>
        </div>
      </div>
    </footer>
  );
}
