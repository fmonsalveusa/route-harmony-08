import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const HOSCONNECT_BASE = 'https://api.hosconnect.com';

interface EldAccount {
  id: string;
  tenant_id: string;
  api_user: string;
  api_password_encrypted: string;
  company_id: string;
}

interface VehicleMap {
  eld_vehicle_id: string;
  driver_id: string;
  truck_id: string | null;
  tenant_id: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Fetch all active ELD accounts
    const { data: accounts, error: accErr } = await supabase
      .from('eld_accounts')
      .select('id, tenant_id, api_user, api_password_encrypted, company_id')
      .eq('is_active', true);

    if (accErr) throw new Error(`Failed to fetch ELD accounts: ${accErr.message}`);
    if (!accounts || accounts.length === 0) {
      return new Response(JSON.stringify({ message: 'No active ELD accounts' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results: { account_id: string; vehicles_updated: number; error?: string }[] = [];

    for (const account of accounts as EldAccount[]) {
      try {
        // 1. Authenticate with HOSconnect
        const authRes = await fetch(`${HOSCONNECT_BASE}/authentication`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user: account.api_user,
            password: account.api_password_encrypted, // stored as plain text for now
            company: account.company_id,
          }),
        });

        if (!authRes.ok) {
          const errText = await authRes.text();
          results.push({ account_id: account.id, vehicles_updated: 0, error: `Auth failed [${authRes.status}]: ${errText}` });
          continue;
        }

        const authData = await authRes.json();
        const accessToken = authData.accessToken || authData.token;

        if (!accessToken) {
          results.push({ account_id: account.id, vehicles_updated: 0, error: 'No access token in auth response' });
          continue;
        }

        // 2. Fetch latest vehicle statuses
        const statusRes = await fetch(`${HOSCONNECT_BASE}/latest_vehicle_statuses`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!statusRes.ok) {
          const errText = await statusRes.text();
          results.push({ account_id: account.id, vehicles_updated: 0, error: `Vehicle status fetch failed [${statusRes.status}]: ${errText}` });
          continue;
        }

        const vehicles = await statusRes.json();
        const vehicleList = Array.isArray(vehicles) ? vehicles : vehicles.data || [];

        // 3. Get vehicle mappings for this account
        const { data: mappings } = await supabase
          .from('eld_vehicle_map')
          .select('eld_vehicle_id, driver_id, truck_id, tenant_id')
          .eq('eld_account_id', account.id)
          .eq('is_active', true);

        if (!mappings || mappings.length === 0) {
          results.push({ account_id: account.id, vehicles_updated: 0, error: 'No vehicle mappings' });
          continue;
        }

        const mapLookup = new Map<string, VehicleMap>();
        for (const m of mappings as VehicleMap[]) {
          mapLookup.set(m.eld_vehicle_id, m);
        }

        // 4. Upsert driver_locations
        let updatedCount = 0;
        for (const v of vehicleList) {
          const vehicleId = String(v.vehicleId || v.vehicle_id || v.id || '');
          const mapping = mapLookup.get(vehicleId);
          if (!mapping) continue;

          const lat = v.lat ?? v.latitude;
          const lng = v.lon ?? v.lng ?? v.longitude;
          if (lat == null || lng == null) continue;

          const payload = {
            driver_id: mapping.driver_id,
            tenant_id: mapping.tenant_id,
            lat: Number(lat),
            lng: Number(lng),
            speed: v.speed != null ? Number(v.speed) : null,
            heading: v.heading ?? v.bearing ?? null,
            accuracy: null,
            source: 'eld',
            updated_at: new Date().toISOString(),
          };

          const { error: upsertErr } = await supabase
            .from('driver_locations')
            .upsert(payload, { onConflict: 'driver_id' });

          if (!upsertErr) updatedCount++;
        }

        // Update last_synced_at
        await supabase
          .from('eld_accounts')
          .update({ last_synced_at: new Date().toISOString() })
          .eq('id', account.id);

        results.push({ account_id: account.id, vehicles_updated: updatedCount });
      } catch (e) {
        results.push({ account_id: account.id, vehicles_updated: 0, error: String(e) });
      }
    }

    console.log('[eld-sync] Results:', JSON.stringify(results));

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[eld-sync] Error:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
