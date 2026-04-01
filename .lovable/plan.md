

## Add Driver Name to Investor Payment Cards

The driver name is available by joining `loads.driver_id` → `drivers.name`. The `enrichPayments` function already fetches loads; we just need to also fetch the driver name and pass it through.

### Changes

**File: `src/hooks/useDriverPayments.ts`**
- In `enrichPayments`, expand the loads query to also fetch `driver_id`
- Add a second lookup to `drivers` table using the driver IDs from loads to get driver names
- Add a `driver_name` field to each enriched payment

**File: `src/hooks/useDriverPayments.ts` (interface)**
- Add `driver_name?: string` to `DriverPayment` interface

**File: `src/pages/driver-app/InvestorDashboard.tsx`**
- Show driver name on each payment card in the `RecentPayments` section (already shows `recipient_name` as "Driver: ..."; switch to `driver_name`)

**File: `src/pages/driver-app/DriverPayments.tsx`**
- Show driver name on investor payment cards in `PaymentList` (same pattern)

### Detail

In `enrichPayments`:
```typescript
// Current: fetches loads with id, origin, destination
// New: also fetch driver_id, then batch-fetch driver names
const [{ data: loads }, { data: adjustments }] = await Promise.all([
  supabase.from('loads').select('id, origin, destination, driver_id').in('id', loadIds),
  supabase.from('payment_adjustments').select('*').in('payment_id', paymentIds),
]);

// Get unique driver IDs and fetch names
const driverIds = [...new Set((loads || []).map(l => l.driver_id).filter(Boolean))];
const { data: drivers } = driverIds.length
  ? await supabase.from('drivers').select('id, name').in('id', driverIds)
  : { data: [] };
const driverMap = new Map((drivers || []).map(d => [d.id, d.name]));

// In the map: add driver_name from load's driver_id
driver_name: load ? driverMap.get(load.driver_id) || '' : '',
```

This is a small data enrichment change — no database migrations needed.

