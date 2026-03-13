import { motion } from "framer-motion";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useLandingLang } from "@/contexts/LandingLanguageContext";
import t from "./landingTranslations";

export function FAQSection() {
  const { lang } = useLandingLang();
  const tr = t[lang];

  return (
    <section id="faq" className="py-20 bg-background">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">{tr.faqTitle}</h2>
          <p className="text-muted-foreground">{tr.faqSubtitle}</p>
        </motion.div>

        <Accordion type="single" collapsible className="space-y-3">
          {tr.faqs.map((faq, i) => (
            <AccordionItem key={i} value={`faq-${i}`} className="bg-card border rounded-xl px-5 data-[state=open]:shadow-sm">
              <AccordionTrigger className="text-left text-foreground font-medium text-sm hover:no-underline">{faq.q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground text-sm leading-relaxed">{faq.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
