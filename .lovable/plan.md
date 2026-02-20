
## Fix: Pickup Pictures not showing uploaded files

### Root cause
The `fetchDocs` query in `PickupPicturesSection.tsx` filters documents using `.in('stop_id', stopIds)` which only returns documents where `stop_id` matches a pickup stop. However, most existing documents in the database have `stop_id = NULL` (uploaded via the POD section or driver app). This means they are invisible to the pickup pictures section.

Additionally, there is a minor bug where the `setUploading(false)` in the `finally` block may not run correctly if the tenant check returns early.

### Fix details

**File: `src/components/PickupPicturesSection.tsx`**

1. Change the `fetchDocs` query to use an `.or()` filter instead of `.in()` so it includes documents where `stop_id` is NULL or matches a pickup stop ID:
   - Replace `.in('stop_id', stopIds)` with `.or(`stop_id.in.(${stopIds.join(',')}),stop_id.is.null`)` 
   - This ensures documents uploaded without a stop_id (from the driver app or the existing POD upload) are also visible

2. Fix the early return when `tenantId` is null so that `setUploading(false)` is properly called (move the return to after the finally or restructure the flow)

### What this means for you
After this fix, any photos uploaded by the driver from the mobile app or by you via "Subir BOL" will appear in the Pick Up Pictures section, regardless of whether the `stop_id` was set during upload.
