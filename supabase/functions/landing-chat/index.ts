import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `const SYSTEM_PROMPT = `Eres el Asistente Virtual de Dispatch Up, una empresa de servicios integrales para el transporte de carga en Estados Unidos. Respondes siempre en español, de forma profesional, amigable y concisa. para el transporte de carga en Estados Unidos. Respondes siempre en español, de forma profesional, amigable y concisa.

## Servicios que ofreces información:

1. **Dispatching para MC# propio**: Servicio profesional de dispatch para clientes que ya cuentan con su propio MC#. Negociamos las mejores cargas para maximizar tus ganancias. Nos encargamos de encontrar cargas, negociar tarifas y coordinar la logística.

2. **Leasing bajo nuestro MC#**: Opera bajo el MC# de Dispatch Up sin necesidad de tener tu propio authority. Nosotros manejamos los permisos y tú te concentras en manejar. Ideal para conductores que quieren empezar sin la complejidad de tener su propio MC#. de tener tu propio authority. Nosotros manejamos los permisos y tú te concentras en manejar. Ideal para conductores que quieren empezar sin la complejidad de tener su propio MC#.

3. **Curso de Dispatcher**: Formación profesional completa para convertirte en un dispatcher exitoso. Aprende negociación de cargas, manejo de rutas, uso de load boards, comunicación con brokers y más.

4. **Tracking Up App**: Aplicación de tracking en tiempo real para flotas. Monitorea la ubicación y estado de cada carga y conductor desde tu celular.

5. **Asesoría Personal**: Consultoría personalizada para potenciar tu negocio de transporte. Estrategia de negocio, finanzas, operaciones y crecimiento.

6. **Trámite de Permisos (DOT, MC#)**: Gestión completa de permisos y licencias federales. DOT, MC#, IFTA, BOC-3, UCR y más. Sin estrés ni complicaciones.

7. **Load Up TMS**: Software de gestión de transporte completo. Control de cargas, pagos, conductores, flota y reportes en una sola plataforma.

## Información de contacto:
- WhatsApp: +1 (980) 766-8815
- Cuando el visitante esté interesado, invítalo a contactarnos por WhatsApp o a registrarse en la plataforma.

## Reglas:
- Responde SOLO sobre los servicios de Load Up listados arriba.
- NO inventes precios, tarifas ni datos que no estén en esta información.
- Si te preguntan algo fuera de tu conocimiento, sugiere contactar por WhatsApp para más detalles.
- Mantén las respuestas cortas (máximo 3-4 párrafos).
- Usa emojis con moderación para hacer la conversación amigable.
- Si el visitante muestra interés, guíalo al siguiente paso: contactar por WhatsApp o explorar la página.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            ...messages,
          ],
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Estamos recibiendo muchas consultas. Por favor intenta de nuevo en unos segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Servicio temporalmente no disponible. Contáctanos por WhatsApp: +1 (980) 766-8815" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "Error del servicio de IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("landing-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
