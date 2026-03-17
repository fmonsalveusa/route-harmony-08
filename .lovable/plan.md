

## Fix: Auto-set Factoring to "Pending" on Delivery

### Problem
When a driver marks a load as "Delivered" from the mobile app, the `factoring` column stays `null`/blank. It should automatically be set to `"Pending"`.

### Change
**`src/components/driver-app/StopCard.tsx`** — line 143, add `factoring: 'Pending'` to the update:

```typescript
// Before:
await supabase.from('loads').update({ status: 'delivered' }).eq('id', stop.load_id);

// After:
await supabase.from('loads').update({ status: 'delivered', factoring: 'Pending' }).eq('id', stop.load_id);
```

Single line change, no other files affected.

