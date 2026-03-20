

## Plan: Show Investor Payments in Driver Mobile App (Simplified)

### Approach — No New Role Needed

Instead of creating a new `investor` role, we use a simpler approach: add an `investor_email` field to the `drivers` table. When a driver user logs into the mobile app, we check if their email appears as `investor_email` on any driver record. If it does, we show a second tab with their investor payments. No role changes, no auth routing changes, no edge function changes.

```text
Driver logs in (email: john@email.com)
  │
  ├─ drivers.email = john@email.com → fetch driver payments (existing)
  │
  └─ drivers.investor_email = john@email.com → fetch investor payments (new)
       └─ payments where recipient_type='investor' AND recipient_id IN those driver IDs
```

### Changes

**1. Database migration** — Add `investor_email` column to `drivers`
```sql
ALTER TABLE public.drivers ADD COLUMN investor_email text;
```

**2. `src/hooks/useDrivers.ts`** — Add `investor_email` to `DbDriver` and `DriverInput` interfaces.

**3. `src/components/DriverFormDialog.tsx`** — Add "Investor Email" field next to the existing "Investor Name" and "Investor Pay %" fields. Only visible when investor fields are filled.

**4. `src/hooks/useDriverPayments.ts`** — Extend to also query investor payments:
- Find drivers where `investor_email = profile.email`
- Fetch payments with `recipient_type = 'investor'` for those driver IDs
- Return both sets separately with separate totals

**5. `src/pages/driver-app/DriverPayments.tsx`** — Add tabs "My Payments" / "Investor Payments" when investor payments exist. Each tab shows its own summary cards and payment list.

### What stays the same
- No new role in `app_role` enum
- No changes to `manage-user` edge function
- No changes to `UserFormDialog`
- No changes to auth routing or `DriverMobileLayout`
- No RLS changes (existing tenant policies cover the queries)

### Technical Details
- The `investor_email` field is optional — existing drivers without it work exactly as before
- If a user has no investor payments, the tabs don't appear (single view as today)
- Payment generation logic (`usePayments.ts`) already sets `recipient_id = driver.id` for investor payments, so the query just needs to find drivers by `investor_email` then look up their payments

