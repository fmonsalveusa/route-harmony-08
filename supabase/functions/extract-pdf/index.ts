import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    console.log('Processing PDF for data extraction...');

    const systemPrompt = `You are a data extraction assistant for a trucking/logistics company. 
You will receive a PDF document (rate confirmation, BOL, or similar). 
Extract the following fields and return them using the extract_load_data tool.
If a field cannot be found, leave it as an empty string or 0 for numbers.
Dates should be in YYYY-MM-DD format.
For cargoType, use one of: dry_van, reefer, flatbed.
For weight, extract the numeric value in lbs.`;

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
                text: 'Extract all load/shipment information from this PDF document.'
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
              description: 'Extract structured load/shipment data from a document',
              parameters: {
                type: 'object',
                properties: {
                  origin: { type: 'string', description: 'Pickup city and state (e.g. "Houston, TX")' },
                  destination: { type: 'string', description: 'Delivery city and state (e.g. "Dallas, TX")' },
                  pickupDate: { type: 'string', description: 'Pickup date in YYYY-MM-DD format' },
                  deliveryDate: { type: 'string', description: 'Delivery date in YYYY-MM-DD format' },
                  weight: { type: 'number', description: 'Weight in lbs' },
                  cargoType: { type: 'string', enum: ['dry_van', 'reefer', 'flatbed'], description: 'Type of trailer/cargo' },
                  totalRate: { type: 'number', description: 'Total rate/payment amount in USD' },
                  referenceNumber: { type: 'string', description: 'Reference number, confirmation number, or load number' },
                  brokerClient: { type: 'string', description: 'Broker or client company name' },
                },
                required: ['origin', 'destination', 'pickupDate', 'deliveryDate', 'weight', 'cargoType', 'totalRate', 'referenceNumber', 'brokerClient'],
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

    // Extract tool call arguments
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

    return new Response(
      JSON.stringify({ success: true, data: extractedData }),
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
