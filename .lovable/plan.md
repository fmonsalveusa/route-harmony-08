

## Termination Letter Generation & Storage for Drivers

### What the document contains
A bilingual (English pages 1-2, Spanish pages 3-4) **Lease Agreement Termination Letter** from the tenant company to the driver, including:
- Driver name
- Vehicle info (Year, Make, Model, VIN, License Plate)
- Five sections: Termination notice, Prohibition on use of company info, Removal of markings, Legal consequences, Acknowledgment
- Company representative signature block with date

### Plan

#### 1. Database: Add `termination_letter_url` column to `drivers`
- New nullable `text` column to store the storage path of the generated/uploaded PDF.

#### 2. PDF Generation: New function `generateTerminationLetterPdf` in `src/lib/onboardingDocPdf.ts`
- Accepts: driver name, vehicle details (year, make, model, VIN, license plate), company/tenant name, authorized representative name, and date.
- Generates a 4-page PDF (2 English + 2 Spanish) replicating the uploaded template using the existing `writeBlock`/`writeHeading` helpers.
- Dynamically fills driver name, vehicle fields, company name (from tenant), and issuance date.
- Returns a `Blob`.

#### 3. New Component: `TerminationLetterDialog` 
- A dialog accessible from the driver's actions (Drivers page table row).
- Shows a confirmation with pre-filled driver/truck data.
- On "Generate": calls `generateTerminationLetterPdf`, uploads the PDF to `driver-documents` storage, saves the path to `drivers.termination_letter_url`, and shows a success toast.

#### 4. UI Integration in `DriverDetailPanel`
- Add a "Termination Letter" entry in the documents section.
- If `termination_letter_url` exists: show "View" link (signed URL) + "Delete" button to clear the field.
- Add a button to generate/regenerate the letter (opens `TerminationLetterDialog`).

#### 5. UI Integration in Drivers page
- Add a "Termination Letter" action button in the actions column (or as a dropdown option) for each driver row, visible to admin/accounting roles.

#### 6. Update `DbDriver` interface
- Add `termination_letter_url: string | null` to the type definition.

### Files to create/modify
- **Migration SQL**: Add `termination_letter_url` column
- **`src/lib/onboardingDocPdf.ts`**: Add `generateTerminationLetterPdf` function
- **`src/components/TerminationLetterDialog.tsx`**: New dialog component
- **`src/components/DriverDetailPanel.tsx`**: Add termination letter to documents section with view/delete/generate
- **`src/pages/Drivers.tsx`**: Wire the dialog trigger
- **`src/hooks/useDrivers.ts`**: Add field to `DbDriver` interface

