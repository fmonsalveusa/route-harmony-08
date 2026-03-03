

## Recurring Deductions for Drivers & Investors

### Problem
Some drivers and investors have periodic deductions (insurance, ELD, bank fees, etc.) that need to be applied automatically every time a payment is generated. Currently, these must be added manually as payment adjustments each time.

### Solution
Create a **Recurring Deductions** configuration system, similar to how `truck_fixed_costs` works, but tied to drivers/investors. When payments are auto-generated via `generatePaymentsForLoad`, the system will look up active recurring deductions for that recipient and automatically insert them as `payment_adjustments`.

### Database Changes

**New table: `recurring_deductions`**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| recipient_id | text | Driver ID |
| recipient_type | text | 'driver' or 'investor' |
| recipient_name | text | Display name |
| description | text | e.g. "Weekly Insurance", "ELD" |
| amount | numeric | Deduction amount |
| frequency | text | 'per_load', 'weekly', 'monthly' |
| reason | text | Maps to existing ADJUSTMENT_REASONS |
| is_active | boolean | Default true |
| tenant_id | uuid | Multi-tenant |
| created_at / updated_at | timestamptz | Standard |

RLS policies: standard tenant-based (select, insert, update, delete).

### Frequency Logic
- **per_load**: Applied to every payment generated for this recipient.
- **weekly**: Applied once per calendar week. Before inserting, check if this deduction was already applied to any payment created in the same ISO week.
- **monthly**: Applied once per calendar month. Same duplicate check but by month.

### Code Changes

1. **New hook `useRecurringDeductions.ts`**: CRUD operations for the new table, following the `useTruckFixedCosts` pattern (React Query).

2. **New dialog `RecurringDeductionDialog.tsx`**: Configure recurring deductions per driver/investor. Fields: description, amount, frequency, reason. Accessible from the Payments page (new button or per-recipient action).

3. **Update `generatePaymentsForLoad` in `usePayments.ts`**: After creating payments and propagating load adjustments, query `recurring_deductions` for each recipient. For 'per_load' items, always insert. For 'weekly'/'monthly', check existing `payment_adjustments` with matching `recurring_deduction_id` in the current period before inserting.

4. **Add `recurring_deduction_id` column to `payment_adjustments`**: Optional FK to track which recurring deduction generated the adjustment (prevents duplicates and enables audit).

5. **UI in Payments page**: Add a "Recurring Deductions" management section or button. Show configured deductions per driver/investor with ability to add, edit, toggle active, and delete.

### Implementation Order
1. Create `recurring_deductions` table + add `recurring_deduction_id` to `payment_adjustments`
2. Build `useRecurringDeductions` hook
3. Build `RecurringDeductionDialog` component
4. Integrate into Payments page UI
5. Update `generatePaymentsForLoad` to auto-apply recurring deductions

