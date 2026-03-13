

# Plan: Add Spanish/English Language Toggle to Landing Page

## Overview
Add a language switcher (ES/EN) to the landing page navbar that toggles all text content between Spanish and English. The current language preference will be stored in a React context and persisted in localStorage.

## Architecture

1. **Create a `LandingLanguageContext`** (`src/contexts/LandingLanguageContext.tsx`)
   - React context with `lang` ("es" | "en") state and `toggleLang` function
   - Defaults to "es", persists choice in localStorage

2. **Create a translations file** (`src/components/landing/landingTranslations.ts`)
   - A single dictionary object keyed by section, with `es` and `en` variants for every string across all landing components:
     - Navbar links, buttons
     - HeroSection (headline, subheadline, form labels, placeholders, toasts)
     - StatsSection labels
     - ServicesSection (category tabs, modal text)
     - servicesData (title, description, details, benefits, CTA labels for each service)
     - HowItWorks (section title, advantage titles/descriptions)
     - VehicleGallery (section title, vehicle descriptions, tags)
     - MeetingSection (all form labels, placeholders, time slots)
     - OnboardingSection (CTA text, form labels, benefits)
     - FAQSection (all Q&A pairs)
     - LandingFooter (CTA, links, contact labels)
     - Vehicle data in LandingNavbar (details, cargas, benefits)

3. **Add language toggle button to `LandingNavbar`**
   - A small "ES | EN" toggle button in the desktop nav (next to phone number) and mobile menu
   - Clicking switches the context language

4. **Wrap `Landing.tsx` with the provider**
   - `<LandingLanguageProvider>` wraps all landing content

5. **Update each landing component**
   - Import `useLandingLanguage()` hook and the translations object
   - Replace all hardcoded Spanish strings with `t[lang].keyName` lookups
   - Components affected: LandingNavbar, HeroSection, StatsSection, ServicesSection, HowItWorks, VehicleGallery, MeetingSection, OnboardingSection, FAQSection, LandingFooter, AIChatWidget, ServicePricingSection

## UI for the Toggle
- Desktop: A pill-shaped button showing a globe icon + "ES" or "EN" text, placed between the phone number and "Iniciar Sesión" in the navbar
- Mobile: Same toggle at the top of the mobile menu

## Scope
- Only the landing page (`/`) is affected — the rest of the app remains in English
- The AI chat widget system prompt would also need the language passed so it responds in the correct language

