import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { driver_id, title, message, load_id } = await req.json();

    if (!driver_id || !title || !message) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const fcmServerKey = Deno.env.get('FCM_SERVER_KEY');

    if (!fcmServerKey) {
      return new Response(JSON.stringify({ error: 'FCM_SERVER_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get all tokens for this driver
    const { data: tokens, error } = await supabase
      .from('push_tokens')
      .select('token')
      .eq('driver_id', driver_id);

    if (error || !tokens || tokens.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: 'No tokens found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let sent = 0;
    const staleTokens: string[] = [];

    for (const { token } of tokens) {
      const fcmPayload = {
        to: token,
        notification: {
          title,
          body: message,
          sound: 'default',
          click_action: 'FCM_PLUGIN_ACTIVITY',
        },
        data: {
          title,
          message,
          load_id: load_id || '',
        },
      };

      const fcmRes = await fetch('https://fcm.googleapis.com/fcm/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `key=${fcmServerKey}`,
        },
        body: JSON.stringify(fcmPayload),
      });

      const fcmData = await fcmRes.json();
      
      if (fcmData.success === 1) {
        sent++;
      } else if (fcmData.results?.[0]?.error === 'NotRegistered' || fcmData.results?.[0]?.error === 'InvalidRegistration') {
        staleTokens.push(token);
      }
    }

    // Clean up stale tokens
    if (staleTokens.length > 0) {
      await supabase
        .from('push_tokens')
        .delete()
        .eq('driver_id', driver_id)
        .in('token', staleTokens);
    }

    return new Response(JSON.stringify({ sent, total: tokens.length, cleaned: staleTokens.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
