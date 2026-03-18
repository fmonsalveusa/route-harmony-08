

# Plan: Integrate HOSconnect ELD API for Fleet Tracking

## Overview

Replace the mobile app GPS tracking with server-side polling of the HOSconnect API. A scheduled backend function will fetch vehicle positions every 2-3 minutes and write them into the existing `driver_locations` table. The frontend tracking map stays unchanged since it already reads from that table via realtime.

## Architecture

```text
┌──────────────┐    every 2 min     ┌──────────────────┐
│  pg_cron     │ ──────────────────► │  Edge Function   │
│  (scheduler) │                     │  eld-sync        │
└──────────────┘                     └────────┬─────────┘
                                              │
                                    ┌─────────▼──────────┐
                                    │  HOSconnect API     │
                                    │  /authentication    │
                                    │  /latest_vehicle_   │
                                    │   statuses          │
                                    └─────────┬──────────┘
                                              │
                                    ┌─────────▼──────────┐
                                    │  driver_locations   │
                                    │  (upsert)          │
                                    └────────────────────┘
```

## Step-by-step

### 1. Database: New `eld_accounts` table

Stores HOSconnect credentials per tenant (supports multiple HOS247 accounts).

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| tenant_id | uuid | RLS scoped |
| provider | text | Default `'hos247'` |
| api_user | text | HOS247 login user |
| api_password_encrypted | text | Encrypted password |
| company_id | text | HOS247 company ID |
| is_active | boolean | Default true |
| last_synced_at | timestamptz | |

### 2. Database: New `eld_vehicle_map` table

Maps HOS247 vehicle IDs to internal driver/truck IDs.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| tenant_id | uuid | |
| eld_account_id | uuid FK | |
| eld_vehicle_id | text | From HOSconnect |
| eld_vehicle_name | text | For display |
| driver_id | uuid | FK to drivers |
| truck_id | uuid | FK to trucks |
| is_active | boolean | Default true |

RLS policies on both tables: tenant-scoped CRUD for authenticated users.

### 3. Edge Function: `eld-sync`

- Called by pg_cron every 2 minutes
- For each active `eld_accounts` row:
  1. `POST /authentication` with stored credentials to get `accessToken`
  2. `GET /latest_vehicle_statuses` with the token
  3. For each vehicle in response, look up `eld_vehicle_map` to find `driver_id`
  4. Upsert into `driver_locations` with `lat`, `lng`, `speed`, `heading`, `updated_at`
- Uses `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS for upserts
- Logs sync results and updates `last_synced_at`

### 4. pg_cron Job

Schedule the edge function to run every 2 minutes using `pg_cron` + `pg_net`.

### 5. Secret: `HOSCONNECT_BASE_URL`

Store `https://api.hosconnect.com` as a secret (or hardcode since it's public).

### 6. Admin UI: ELD Settings Page

New page accessible from settings for admin users:

- **ELD Accounts section**: Add/edit/delete HOS247 accounts (user, password, company ID). Test connection button.
- **Vehicle Mapping section**: After connecting, fetch vehicles via `GET /vehicles` and show a mapping table where admin assigns each ELD vehicle to an internal driver/truck.
- Auto-sync status indicator showing last sync time.

### 7. Driver App Changes

- **Remove GPS tracking UI**: Hide the `DriverTracking` page and GPS toggle from the driver mobile app for drivers that have an ELD mapping.
- **Keep as fallback**: Drivers without ELD mapping continue using the existing web GPS tracking.
- The `DriverTrackingContext` checks if the driver has an ELD mapping; if yes, skip GPS initialization and show "Tracked via ELD" status instead.

### 8. Tracking Page (Admin)

No changes needed. The map already reads from `driver_locations` via realtime subscriptions. ELD-sourced positions will appear identically to GPS-sourced ones.

Optionally add an "ELD" badge next to driver markers to distinguish the data source.

## What stays the same

- `driver_locations` table and its realtime subscriptions
- Tracking map, driver markers, route visualization
- Geofence arrival detection (runs server-side with ELD coordinates)
- All existing GPS tracking for drivers without ELD

## Requirements from you

1. **HOS247 API credentials** for each account (user, password, company ID)
2. Confirm which vehicles map to which drivers in your fleet

