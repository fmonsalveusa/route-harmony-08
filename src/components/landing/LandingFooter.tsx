import { MessageCircle, Mail, Phone } from "lucide-react";
import logo from "@/assets/logo.png";

export function LandingFooter() {
  return (
    <footer id="contacto" className="bg-[hsl(214,52%,10%)] text-white/70 py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-3 gap-10">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <img src={logo} alt="Load Up" className="h-8 w-auto" />
              <span className="text-white font-bold text-lg">Load Up</span>
            </div>
            <p className="text-sm leading-relaxed">
              Tu socio de confianza en servicios de dispatching, leasing y transporte de carga en Estados Unidos.
            </p>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Servicios</h4>
            <ul className="space-y-2 text-sm">
              <li>Dispatching para MC# propio</li>
              <li>Leasing bajo nuestro MC#</li>
              <li>Curso de Dispatcher</li>
              <li>Tracking Up App</li>
              <li>Asesoría Personal</li>
              <li>Trámite de Permisos</li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Contacto</h4>
            <ul className="space-y-3 text-sm">
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

        <div className="border-t border-white/10 mt-10 pt-6 text-center text-xs text-white/40">
          © {new Date().getFullYear()} Load Up TMS. Todos los derechos reservados.
        </div>
      </div>
    </footer>
  );
}
