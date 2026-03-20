

## Plan: Fix Investor Payments Visibility for Driver+Investor Users

### Root Cause
Two issues prevent Nelson from seeing his investor payments:

1. **RLS policy on `drivers` table** — The driver role can only SELECT their own driver record (where `email` matches). When `useDriverPayments` queries for `drivers WHERE investor_email = user.email`, RLS silently blocks the result because those are other drivers' records.

2. **Missing data** — Jonathan Garcia's `investor_email` is NULL even though `investor_name` is "Nelson Andrade". Only Jheber Guzman has the `investor_email` field populated.

### Changes

**1. Update RLS policy on `drivers` table** (migration)
- Extend the existing SELECT policy to also allow authenticated users to read driver records where `investor_email` matches their own email. This lets the investor payment lookup work.

```sql
-- Add condition: OR (investor_email = profile.email for current user)
```

The existing policy already has multiple OR branches for different roles. We add one more branch for investor email matching.

**2. Update `investor_email` for Jonathan Garcia** (migration)
- Set `investor_email = 'nandrade1955@gmail.com'` on Jonathan Garcia's record so his investor payments are also linked.

### Files Changed
- `supabase/migrations/` — new migration with RLS policy update + data fix

### No code changes needed
The hooks and UI already handle investor payments correctly. The issue is purely at the database access level.

