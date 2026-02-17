

# Truck Maintenance Module - Updated Plan

## Key Update: Total Miles = Loaded Miles + Empty Miles

The system will sum **both** `loads.miles` (loaded miles) and `loads.empty_miles` (deadhead/empty miles) for each load assigned to a truck when calculating accumulated mileage since the last maintenance service. This gives an accurate picture of total wear on the vehicle.

---

## Database

### New table: `truck_maintenance`

| Column | Type | Default | Description |
|---|---|---|---|
| id | uuid (PK) | gen_random_uuid() | |
| truck_id | uuid | -- | FK reference to trucks |
| tenant_id | uuid | null | RLS tenant isolation |
| maintenance_type | text | -- | e.g. "Oil Change", "Tire Rotation" |
| description | text | null | Optional notes |
| interval_miles | numeric | null | Miles between services (null if date-only) |
| interval_days | integer | null | Days between services (null if miles-only) |
| last_performed_at | date | -- | Date of last service |
| last_miles | numeric | 0 | Odometer at last service |
| next_due_miles | numeric | null | Computed: last_miles + interval_miles |
| next_due_date | date | null | Computed: last_performed_at + interval_days |
| miles_accumulated | numeric | 0 | Sum of (miles + empty_miles) from loads since service |
| status | text | 'ok' | "ok", "warning", "due" |
| cost | numeric | null | Cost of service |
| vendor | text | null | Shop/vendor name |
| expense_id | uuid | null | Link to auto-created expense record |
| created_at | timestamptz | now() | |
| updated_at | timestamptz | now() | |

RLS policies: same tenant-based pattern as all other tables (SELECT/INSERT/UPDATE/DELETE with `tenant_id = get_user_tenant_id(auth.uid()) OR is_master_admin(auth.uid())`).

Updated_at trigger using existing `update_updated_at_column()` function.

---

## Mile Accumulation Logic

When recalculating miles for a maintenance record:

```text
SELECT COALESCE(SUM(COALESCE(miles, 0) + COALESCE(empty_miles, 0)), 0)
FROM loads
WHERE truck_id = [truck_id]::text
  AND pickup_date >= [last_performed_at]
  AND status IN ('in_transit', 'delivered', 'paid')
```

This ensures every mile the truck travels -- whether loaded or deadheading -- counts toward the maintenance interval.

### Status thresholds (miles-based):
- **OK**: accumulated < 80% of interval_miles
- **Warning**: accumulated >= 80% of interval_miles
- **Due**: accumulated >= 100% of interval_miles

### Status thresholds (date-based):
- **OK**: today < next_due_date - 30 days
- **Warning**: today >= next_due_date - 30 days
- **Due**: today >= next_due_date

The worst status between miles and date wins (e.g., if miles say "ok" but date says "warning", final status = "warning").

---

## Files to Create

### 1. `src/hooks/useTruckMaintenance.ts`
- CRUD operations for `truck_maintenance`
- `recalculateMiles(truckId)`: fetches loads with `truck_id` matching and `pickup_date >= last_performed_at`, sums `miles + empty_miles`, updates `miles_accumulated` and `status`
- Auto-creates expense in `expenses` table (with `expense_type = 'maintenance'`) when logging a completed maintenance with cost > 0
- Next-number generator for internal tracking

### 2. `src/pages/Maintenance.tsx`
- New dedicated page at route `/maintenance`
- **Header**: "Truck Maintenance" + "Add Maintenance" button
- **Summary cards**: Schedules total, Items due soon (warning), Overdue items (due)
- **Truck-grouped cards**: Each truck shows its maintenance items as cards with:
  - Maintenance type + icon
  - Progress bar (miles accumulated / interval miles) with color coding
  - Last service date and next due info (miles and/or date)
  - Status badge (green/amber/red)
  - Edit / Delete / "Log Service" actions
- Modern card layout with framer-motion animations
- Filter by truck and status

### 3. `src/components/maintenance/MaintenanceFormDialog.tsx`
- Dialog to create/edit a maintenance schedule
- Fields:
  - Truck (select from existing trucks)
  - Maintenance Type (dropdown with presets + custom option)
  - Date Performed
  - Odometer Reading (miles at service)
  - Schedule By: Miles interval, Days interval, or both
  - Cost, Vendor, Notes (optional)
- Toggle: "Create expense record" (on by default when cost > 0)

### 4. `src/components/maintenance/MaintenanceCard.tsx`
- Individual maintenance item card with animated progress bar
- Shows: type, truck unit number, miles progress, date progress, status badge
- Quick actions: Log New Service, Edit, Delete

### 5. `src/components/maintenance/maintenanceConstants.ts`
- Predefined maintenance types with icons and default intervals:
  - Oil Change (default: 10,000 mi)
  - Tire Rotation (default: 15,000 mi)
  - Brake Inspection (default: 25,000 mi)
  - Transmission Service (default: 30,000 mi)
  - Air Filter (default: 15,000 mi)
  - Coolant Flush (default: 30,000 mi)
  - DEF System (default: 10,000 mi)
  - DOT Inspection (default: 365 days)
  - PM Service (default: 25,000 mi)
  - Custom

## Files to Modify

### 6. `src/App.tsx`
- Add route: `/maintenance` pointing to `Maintenance` page (protected)

### 7. `src/components/AppLayout.tsx`
- Add "Maintenance" sidebar entry with wrench icon, positioned after "Fleet"

### 8. `src/pages/Fleet.tsx`
- Add small colored dots next to each truck row indicating maintenance status (green/amber/red)
- Clicking the dot navigates to `/maintenance` filtered by that truck

### 9. `src/components/TruckDetailPanel.tsx`
- Add a "Maintenance" summary section showing active maintenance items with mini progress bars and status

## Integration with Expenses

- When a maintenance is logged with `cost > 0`, an expense is auto-created in the `expenses` table with:
  - `expense_type = 'maintenance'`
  - `truck_id` = the truck
  - `amount` = the cost
  - `vendor` = the vendor
  - `description` = maintenance type
  - `expense_date` = performed date
- The `expense_id` is stored in `truck_maintenance` for reference
- The Expenses page continues showing these for reporting -- no duplicate entry needed

## Notifications

- When `status` changes to "warning" or "due" during recalculation, a notification is inserted into the `notifications` table using the existing system
- The existing `NotificationBell` component displays these automatically -- no changes needed

