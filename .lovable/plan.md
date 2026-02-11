
# Empty Miles (Deadhead) Feature

## What It Does
Each load will automatically calculate and display the "empty miles" -- the distance a driver travels without cargo from their last delivery location to the first pickup of the current load. This helps you see the true cost and efficiency of each assignment.

## How It Works

1. When a load is expanded or viewed, the system will look up the driver's previous load (the most recent delivered/completed load before this one, sorted by delivery date).
2. It will take the last delivery stop of that previous load and calculate the driving distance (via OSRM, same routing engine already in use) to the first pickup stop of the current load.
3. The result is saved to the database so it only needs to be calculated once.
4. On the map in the Load Detail panel, a dashed line will show the deadhead segment from the previous delivery point to the first pickup.

## What You'll See
- A new "Empty Miles" field displayed alongside the existing "Miles" field in the load detail panel and the loads table.
- A dashed route line on the map showing the deadhead path.
- The value updates automatically when the load has a driver assigned and stops with coordinates.

## Technical Details

### Database Change
- Add `empty_miles` (NUMERIC, default 0) and `empty_miles_origin` (TEXT, nullable) columns to the `loads` table.

### Code Changes

**1. `src/hooks/useLoads.ts`**
- Add `empty_miles` and `empty_miles_origin` to the `DbLoad` interface.

**2. `src/components/LoadDetailPanel.tsx`**
- After resolving stops and calculating the main route, look up the driver's previous load (query `loads` table for the same `driver_id`, with `delivery_date` before the current load's `pickup_date`, ordered descending, limit 1).
- Fetch the last delivery stop of that previous load from `load_stops`.
- If coordinates exist (or can be geocoded), calculate driving distance via OSRM to the first pickup of the current load.
- Persist `empty_miles` and `empty_miles_origin` (the address of the previous delivery) to the current load record.
- Render a dashed polyline on the map from the previous delivery point to the first pickup point.
- Display the empty miles value in the info section next to the existing Miles field.

**3. `src/pages/Loads.tsx`**
- Show the `empty_miles` value in the loads table row (new column or alongside existing miles display).

### What Won't Change
- The existing route calculation, miles, stops, and map rendering logic remains untouched.
- All current filters, status workflows, and payment calculations stay the same.
- The empty miles field is purely informational and does not affect financial calculations.
