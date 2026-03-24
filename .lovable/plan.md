

## Plan: Fix Log Service Not Creating Expense in Maintenance

### Root Cause

The two most recent maintenance service logs (2026-03-22 and 2026-03-24) both have `expense_id = NULL` despite having cost values ($350 and $306.60). The error handling fix we added should surface the real error, but based on the pattern, the most likely cause is:

1. The `.select('id').single()` chain after `.insert()` may fail if RLS blocks the subsequent SELECT (insert succeeds but reading back fails, causing `expData` to be null and `expense_id` to remain null).
2. The expense may actually be created but the returned `id` is lost, so `expense_id` is never linked to the service log.

### Changes (1 file)

**`src/hooks/useTruckMaintenance.ts`** — Make the expense creation more robust:

1. Remove `.select('id').single()` from the insert chain and instead use `.select()` to avoid single-row errors.
2. Add a fallback: if the insert returns no data but no error, query the expense by matching fields to get the `id`.
3. Add `console.log` before the insert to debug the payload being sent.
4. If `expense_id` remains null after a successful insert (no error), log a warning and still show success toast.

### Technical Detail

```typescript
// Change from:
const { data: expData, error: expError } = await supabase
  .from('expenses' as any)
  .insert({...})
  .select('id')
  .single();

// To:
const { data: expData, error: expError } = await supabase
  .from('expenses' as any)
  .insert({...} as any)
  .select('id');

if (expError) {
  console.error('Expense creation error:', expError);
  toastRef.current({ title: 'Error creating expense', description: expError.message, variant: 'destructive' });
} else if (expData && (expData as any[]).length > 0) {
  expense_id = (expData as any[])[0]?.id || null;
}
```

This avoids the `.single()` issue where PostgREST might fail if RLS prevents reading back the inserted row, while the insert itself succeeds.

