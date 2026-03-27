import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useLandingLang } from "@/contexts/LandingLanguageContext";
import t from "./landingTranslations";

export function FAQSection() {
  const { lang } = useLandingLang();
  const tr = t[lang];
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return tr.faqs;
    const q = search.toLowerCase();
    return tr.faqs.filter((faq) => faq.q.toLowerCase().includes(q) || faq.a.toLowerCase().includes(q));
  }, [search, tr.faqs]);

  return (
    <section id="faq" className="py-20 bg-background">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-10">
          <span className="text-sm font-semibold text-accent uppercase tracking-wider">FAQ</span>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mt-2 mb-4">{tr.faqTitle}</h2>
          <p className="text-muted-foreground">{tr.faqSubtitle}</p>
        </motion.div>

        {/* Search */}
        <div className="relative mb-8">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={lang === "es" ? "Buscar preguntas..." : "Search questions..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        <Accordion type="single" collapsible className="space-y-3">
          {filtered.map((faq, i) => (
            <AccordionItem key={i} value={`faq-${i}`} className="bg-card border rounded-xl px-5 data-[state=open]:shadow-sm">
              <AccordionTrigger className="text-left text-foreground font-medium text-sm hover:no-underline">{faq.q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground text-sm leading-relaxed">{faq.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        {filtered.length === 0 && (
          <p className="text-center text-muted-foreground py-8 text-sm">
            {lang === "es" ? "No se encontraron resultados." : "No results found."}
          </p>
        )}
      </div>
    </section>
  );
}
