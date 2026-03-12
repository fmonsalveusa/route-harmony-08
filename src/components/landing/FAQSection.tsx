import { motion } from "framer-motion";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const faqs = [
  {
    q: "¿Qué necesito para empezar a trabajar con Dispatch Up?",
    a: "Solo necesitas tu camión y documentos al día. Si no tienes MC#, puedes operar bajo nuestra autoridad. El proceso de registro es 100% digital y toma menos de 2 minutos.",
  },
  {
    q: "¿Cuánto cobran por el servicio de dispatching?",
    a: "Nuestras tarifas comienzan en $200/semana por camión para flotas de 3+ camiones y $250/semana para camiones individuales. El servicio incluye dispatch 24/7, acceso a load boards premium y reportes semanales.",
  },
  {
    q: "¿Puedo operar sin MC# propio?",
    a: "¡Sí! Con nuestro servicio de Leasing bajo MC#, puedes operar legalmente desde el día uno sin necesidad de tener tu propio MC#. Nos encargamos de seguros, compliance y facturación.",
  },
  {
    q: "¿En qué idiomas ofrecen soporte?",
    a: "Todo nuestro equipo es bilingüe. Ofrecemos atención completa en español e inglés, las 24 horas del día, los 7 días de la semana.",
  },
  {
    q: "¿Cómo recibo mis pagos?",
    a: "Los pagos se procesan semanalmente. Recibes un reporte detallado de cada carga y tu pago se deposita directamente en tu cuenta bancaria.",
  },
  {
    q: "¿Qué tipos de vehículos aceptan?",
    a: "Trabajamos con Box Trucks, Hotshots, Dry Vans, Flatbeds y Reefers. Cada tipo de vehículo tiene planes y tarifas adaptadas.",
  },
];

export function FAQSection() {
  return (
    <section id="faq" className="py-20 bg-background">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">Preguntas Frecuentes</h2>
          <p className="text-muted-foreground">
            Respuestas a las dudas más comunes sobre nuestros servicios.
          </p>
        </motion.div>

        <Accordion type="single" collapsible className="space-y-3">
          {faqs.map((faq, i) => (
            <AccordionItem
              key={i}
              value={`faq-${i}`}
              className="bg-card border rounded-xl px-5 data-[state=open]:shadow-sm"
            >
              <AccordionTrigger className="text-left text-foreground font-medium text-sm hover:no-underline">
                {faq.q}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground text-sm leading-relaxed">
                {faq.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
