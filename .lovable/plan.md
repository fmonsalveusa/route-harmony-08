

## Driver Route History Map — Plan

A new page that lets the user select a driver and a time period, then renders a Leaflet map with the complete route for that period, numbered stop markers, and summary KPIs.

### Components

**1. New page: `src/pages/DriverRouteHistory.tsx`**

Top controls:
- Driver selector (from `useDrivers`)
- Period selector: This Week / Last Week / This Month / Last Month

Summary KPI cards (3 `StatCard`-style cards):
- **Total Revenue**: sum of `total_rate` for all loads in the period
- **Total Loaded Miles**: sum of `miles` for all loads in the period
- **RPM**: Total Revenue / Total Loaded Miles

Full-width Leaflet map:
- Each load gets a distinct colored polyline (6-8 color palette)
- Numbered circle markers (`L.DivIcon`) at each stop, sequenced chronologically across all loads
- Popup on markers: load reference, stop type, address, date
- Auto `fitBounds` to show all routes

**2. Data flow**
- Filter loads by `driver_id` + date range (using `pickup_date`)
- Batch query `load_stops` for matching load IDs
- Use cached `route_geometry` from loads; fall back to OSRM for missing routes
- Compute totals from filtered loads: `sum(total_rate)`, `sum(miles)`, derived RPM

**3. Route and nav integration**
- Add route `/driver-route-history` in `App.tsx` (protected)
- Add nav item in `AppLayout.tsx` with `MapPin` or `Route` icon, permission `tracking`

### Files
- **Create**: `src/pages/DriverRouteHistory.tsx`
- **Edit**: `src/App.tsx` (add route), `src/components/AppLayout.tsx` (add nav link)

