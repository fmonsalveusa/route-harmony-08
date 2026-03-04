

## Add Signature to Termination Letter

### Problem
The termination letter currently shows a blank line (`_______________________________`) where the authorized representative's signature should be. The original document had the representative's signature printed on it.

### Solution
Add a **SignaturePad** canvas to the `TerminationLetterDialog` so the representative can draw their signature before generating the PDF. The signature data URL is then embedded into the PDF using the existing `addSignatureImage` helper — replacing the blank line in both the English and Spanish signature blocks.

### Changes

**1. `src/components/TerminationLetterDialog.tsx`**
- Import the existing `SignaturePad` component
- Add state for `signature: string | null`
- Render the SignaturePad below the representative name input
- Require signature before allowing generation
- Pass `signature` to `generateTerminationLetterPdf`

**2. `src/lib/onboardingDocPdf.ts` — `generateTerminationLetterPdf`**
- Add `signature?: string` to the data parameter
- In the English signature block (around line 808-817): if `signature` is provided, call `addSignatureImage(doc, signature, m, y, 50, 15)` instead of the blank underline
- Same for the Spanish signature block (around line 907-916)

### UX Flow
1. User opens Termination Letter dialog
2. Enters representative name
3. Signs on the canvas pad (same component used in onboarding documents)
4. Clicks "Generate & Save"
5. PDF is created with the drawn signature embedded in both English and Spanish pages

