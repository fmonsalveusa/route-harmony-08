import { createContext, useContext, useState, type ReactNode } from "react";

type Lang = "es" | "en";

interface LandingLanguageContextType {
  lang: Lang;
  toggleLang: () => void;
}

const LandingLanguageContext = createContext<LandingLanguageContextType>({
  lang: "es",
  toggleLang: () => {},
});

export function LandingLanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => {
    try {
      const stored = localStorage.getItem("landing-lang");
      return stored === "en" ? "en" : "es";
    } catch {
      return "es";
    }
  });

  const toggleLang = () => {
    setLang((prev) => {
      const next = prev === "es" ? "en" : "es";
      try { localStorage.setItem("landing-lang", next); } catch {}
      return next;
    });
  };

  return (
    <LandingLanguageContext.Provider value={{ lang, toggleLang }}>
      {children}
    </LandingLanguageContext.Provider>
  );
}

export function useLandingLang() {
  return useContext(LandingLanguageContext);
}
