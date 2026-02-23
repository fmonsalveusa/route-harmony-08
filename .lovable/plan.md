

# Fix: Real-time GPS Tracking on Individual Load Maps

## Problem
The GPS live marker works on the Tracking page but NOT on individual load detail maps. The root cause is a **race condition** between two effects in `LoadDetailPanel.tsx`:

1. **Map init effect** (line 299): Async -- imports Leaflet, geocodes stops, draws routes. Takes several seconds.
2. **GPS tracking effect** (line 609): Checks `if (!mapInstanceRef.current) return` -- but the map isn't ready yet because the init is async.

Since `mapInstanceRef` is a React **ref** (not state), when it eventually gets populated, React does NOT re-run the GPS effect. The GPS subscription never starts.

## Solution
Add a **state flag** `mapReady` that gets set to `true` after the map is fully initialized. Include this flag in the GPS effect's dependency array so it re-runs once the map is available.

## File: `src/components/LoadDetailPanel.tsx`

### Change 1: Add `mapReady` state
Near the other state declarations (around line 140), add:
```typescript
const [mapReady, setMapReady] = useState(false);
```

### Change 2: Reset `mapReady` on load change and set it after map init
- At the beginning of the map init effect (line 300 area), reset: `setMapReady(false);`
- After the map is fully initialized (both fast path and slow path complete), call `setMapReady(true);`
- In the cleanup, set `setMapReady(false);`

### Change 3: Add `mapReady` to GPS effect dependencies
Change the GPS effect guard and dependency array:
```typescript
// Before:
useEffect(() => {
  if (!load.driver_id || !mapInstanceRef.current) return;
  // ...
}, [load.id, load.driver_id]);

// After:
useEffect(() => {
  if (!load.driver_id || !mapInstanceRef.current || !mapReady) return;
  // ...
}, [load.id, load.driver_id, mapReady]);
```

This ensures the GPS subscription starts only after the map is ready, and reliably re-triggers when it becomes ready.

## Technical Details

### Why this only affects the load detail panel (not Tracking page)
The Tracking page (`src/pages/Tracking.tsx`) uses `react-leaflet` components (`MapContainer`, `Marker`) which handle the map lifecycle declaratively. The `LoadDetailPanel` uses imperative Leaflet (`L.map()`) inside a `useEffect`, creating the async timing issue.

### Files to modify
1. `src/components/LoadDetailPanel.tsx` -- add `mapReady` state, set it after map init, include in GPS effect deps

### No database changes required
The realtime subscription and `driver_locations` table are already correctly configured.

