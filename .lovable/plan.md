

## Update Service Agreement Contract — QUINTA/FIFTH Clause

After comparing the uploaded V1.2 PDF with the current code in `ServiceAgreementDialog.tsx`, the **only change** is in **Clause QUINTA (Inspecciones en Carretera) / FIFTH (Roadside Inspections)**. The text has been significantly expanded in both Spanish and English versions.

### What changes

**Spanish — QUINTA. INSPECCIONES EN CARRETERA:**
The current short paragraph is replaced with three paragraphs:
1. Driver must notify immediately; must use only their own company info (USDOT, MC, etc.) on both sides of the vehicle. Must never use the Company's identifying information.
2. If Company's name appears on inspection report, Company reserves the right to withhold full payment as "liquidated damages."
3. New paragraph: If Driver operates under a Leasing Agreement and gets a violation/warning/Out-of-Service, a $300 penalty applies. Conversely, a clean inspection earns a $100 safety bonus.

**English — FIFTH. ROADSIDE INSPECTIONS:**
Same three-paragraph expansion as the Spanish version.

### Files to modify

1. **`src/components/onboarding/ServiceAgreementDialog.tsx`** — Replace the QUINTA and FIFTH clause text blocks with the updated V1.2 content.

2. **`src/lib/onboardingDocPdf.ts`** — Update the `generateServiceAgreementPdf` function to include the same updated text in the generated PDF output (both Spanish and English sections).

No changes to fields, signatures, or any other clauses.

