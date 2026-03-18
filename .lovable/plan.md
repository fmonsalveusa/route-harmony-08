

# Plan: Show ELD tracking info in the web app

## Problem
The ELD sync is writing to `driver_locations` with `source: 'eld'`, but the Tracking page ignores the `source` field. All markers show "GPS Live" regardless of origin, and there's no visual distinction for ELD-tracked drivers.

## Changes

### 1. Update `driverLocations` state to include `source`
In `src/pages/Tracking.tsx`, add `source` to the state type (line 172) so the field is available for rendering.

### 2. Show "ELD" vs "GPS" label on map markers
In the driver live location marker popup (line 575), check `loc.source` and display "📡 ELD Tracking" or "📍 GPS Live" accordingly.

### 3. Show ELD badge on available drivers panel
In the available drivers list (around line 646), check if a driver has an active `driver_locations` entry with `source === 'eld'` and show an "ELD" badge instead of (or alongside) the GPS indicator.

### 4. Add ELD indicator on Drivers page
In `src/pages/Drivers.tsx`, where GPS activity is tracked (the existing realtime subscription for `driver_locations`), also fetch and display the `source` field so ELD-tracked drivers show a distinct badge in the drivers table.

## Files to modify
- `src/pages/Tracking.tsx` — include `source` in state, update marker popup text and available drivers badge
- `src/pages/Drivers.tsx` — show ELD badge for drivers tracked via ELD

## Scope
Small UI-only changes. No database or edge function modifications needed.

