import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authentication check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user belongs to active tenant
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (!profile?.tenant_id) {
      return new Response(
        JSON.stringify({ error: 'No active tenant' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { pdfBase64 } = await req.json();

    if (!pdfBase64) {
      return new Response(
        JSON.stringify({ error: 'PDF data is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Processing PDF for data extraction with multi-stop support...');

    const systemPrompt = `You are a data extraction assistant for a trucking/logistics company. 
You will receive a PDF document (rate confirmation, BOL, or similar). 
Extract ALL stops from the document — there may be multiple pickup locations and multiple delivery locations.
For each stop address, extract ONLY the physical address (street, city, state, zip). Do NOT include the company name, facility name, or stop label in the address field.
Example: Instead of "ABC Warehouse - 123 Main St, Houston, TX 77001", just return "123 Main St, Houston, TX 77001".
If only city and state are available, return "City, ST" format.
Return stops in route order (first pickup first, last delivery last).
If a field cannot be found, leave it as an empty string or 0 for numbers.
Dates should be in YYYY-MM-DD format.
For weight, extract the numeric value in lbs.
IMPORTANT: Look carefully for ALL stops — some documents have multiple pickup and/or delivery locations listed as "Stop 1", "Stop 2", etc. or as separate sections.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Extract all load/shipment information from this PDF document, including ALL pickup and delivery stops.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:application/pdf;base64,${pdfBase64}`
                }
              }
            ]
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'extract_load_data',
              description: 'Extract structured load/shipment data from a document, including all stops',
              parameters: {
                type: 'object',
                properties: {
                  referenceNumber: { type: 'string', description: 'Reference number, confirmation number, or load number' },
                  brokerClient: { type: 'string', description: 'Broker or client company name' },
                  totalRate: { type: 'number', description: 'Total rate/payment amount in USD' },
                  weight: { type: 'number', description: 'Weight in lbs' },
                  miles: { type: 'number', description: 'Total miles if shown in document' },
                  stops: {
                    type: 'array',
                    description: 'All pickup and delivery stops in route order',
                    items: {
                      type: 'object',
                      properties: {
                        stopType: { type: 'string', enum: ['pickup', 'delivery'], description: 'Whether this is a pickup or delivery stop' },
                        address: { type: 'string', description: 'Full address or city, state of the stop' },
                        date: { type: 'string', description: 'Date for this stop in YYYY-MM-DD format, empty if not found' },
                      },
                      required: ['stopType', 'address'],
                      additionalProperties: false,
                    }
                  },
                },
                required: ['referenceNumber', 'brokerClient', 'totalRate', 'weight', 'stops'],
                additionalProperties: false,
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'extract_load_data' } },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Demasiadas solicitudes. Intenta de nuevo en unos segundos.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos de IA agotados. Agrega fondos en Settings.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: 'Error al procesar el PDF con IA' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log('AI response received');

    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      console.error('No tool call in response:', JSON.stringify(data));
      return new Response(
        JSON.stringify({ error: 'No se pudo extraer información del PDF' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const extractedData = JSON.parse(toolCall.function.arguments);
    console.log('Extracted data:', JSON.stringify(extractedData));

    // Derive origin/destination from stops for backward compatibility
    const stops = extractedData.stops || [];
    const pickups = stops.filter((s: any) => s.stopType === 'pickup');
    const deliveries = stops.filter((s: any) => s.stopType === 'delivery');

    const result = {
      referenceNumber: extractedData.referenceNumber || '',
      brokerClient: extractedData.brokerClient || '',
      totalRate: extractedData.totalRate || 0,
      weight: extractedData.weight || 0,
      miles: extractedData.miles || 0,
      origin: pickups[0]?.address || '',
      destination: deliveries[deliveries.length - 1]?.address || '',
      pickupDate: pickups[0]?.date || '',
      deliveryDate: deliveries[deliveries.length - 1]?.date || '',
      stops: stops.map((s: any) => ({
        stop_type: s.stopType,
        address: s.address,
        date: s.date || '',
      })),
    };

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error processing PDF:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Error desconocido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
