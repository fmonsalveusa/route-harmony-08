

## Plan: Fix Log Service Not Creating Expense Records

### Diagnosis
The `logNewService` function in `useTruckMaintenance.ts` inserts into the `expenses` table but **does not check the error** from the insert (line 254). If the insert fails silently (RLS, null tenant_id, or missing field), no expense is created and the user sees no error.

Additionally, the expense insert is missing the `driver_name` and `driver_service_type` fields that the Expenses page uses for display/filtering. Without these, even if inserted, it may not show properly in filtered views.

### Changes (1 file)

**`src/hooks/useTruckMaintenance.ts`** — Fix the `logNewService` function:

1. **Add error handling** on the expense insert — log/toast errors so they aren't silent.
2. **Add `driver_name` and `driver_service_type`** to the expense insert by looking up the driver assigned to the truck from `maintenanceItems` context or querying the driver.
3. **Add `category`** field (use the maintenance type as category for better categorization in expense reports).

### Technical Detail
```typescript
// Current (silent failure):
const { data: expData } = await supabase.from('expenses').insert({...}).select('id').single();

// Fixed (with error handling):
const { data: expData, error: expError } = await supabase.from('expenses').insert({...}).select('id').single();
if (expError) {
  toastRef.current({ title: 'Error creating expense', description: expError.message, variant: 'destructive' });
}
```

This will either fix the issue by surfacing the real error, or confirm the insert works and the problem is elsewhere (e.g., filtering on the Expenses page).

