

## Plan: Add "Driver Pay" Column to Performance Table

### Current State
The Performance page already calculates `driverPay` per truck (from `load.driver_pay_amount`) and includes it in the net profit calculation. However, it is **not shown as a separate column** in the table — it's hidden inside the "Expenses" total.

### Changes (1 file: `src/pages/Performance.tsx`)

1. **Add a "Driver Pay" column header** between "Fixed Costs" and "% Factoring" in the table header.
2. **Add the corresponding data cell** displaying `t.driverPay` for each truck row.
3. **Add the total** for Driver Pay in the totals row.
4. **Update `colSpan`** on the empty-state row to account for the new column (12 → 13).

No database changes needed — the data (`driver_pay_amount`) is already loaded from the `loads` table and computed per truck.

