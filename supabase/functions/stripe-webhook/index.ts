import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { SmtpClient } from "https://deno.land/x/smtp@v0.7.0/mod.ts";

const logStep = (step: string, details?: any) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[STRIPE-WEBHOOK] ${step}${d}`);
};

const PLAN_LIMITS: Record<string, { max_drivers: number; max_loads: number; plan: string }> = {
  price_1T9m2l75IaXwYE4pcdPsFO9n: { max_drivers: 5, max_loads: -1, plan: "basic" },
  price_1T9m4a75IaXwYE4pPWVH3AAN: { max_drivers: 20, max_loads: -1, plan: "pro" },
  price_1T9m5t75IaXwYE4pS3HDd67D: { max_drivers: -1, max_loads: -1, plan: "enterprise" },
};

const SERVICE_NAMES: Record<string, string> = {
  "price_1T9tJ175IaXwYE4pEqVJqVlW": "Tracking Up App ($49/mes)",
  "price_1T9u2r75IaXwYE4pJIxqbJ56": "Curso de Dispatcher ($250)",
  "price_1T9tK575IaXwYE4pKcQDlrSH": "Asesoría Personal ($150)",
  "price_1T9tKe75IaXwYE4pAZC1XmiQ": "Trámite de Permisos ($1,500)",
  "price_1T9u3M75IaXwYE4pPBNztAe3": "Auditorías FMCSA ($250)",
};

async function sendNotificationEmail(serviceName: string, amount: number, customerEmail: string) {
  const notificationEmail = Deno.env.get("NOTIFICATION_EMAIL");
  const gmailUser = Deno.env.get("GMAIL_USER");
  const gmailPass = Deno.env.get("GMAIL_APP_PASSWORD");

  if (!notificationEmail || !gmailUser || !gmailPass) {
    logStep("Missing email config, skipping notification");
    return;
  }

  const now = new Date().toLocaleString("es-MX", { timeZone: "America/Chicago" });

  const client = new SmtpClient();
  await client.connectTLS({
    hostname: "smtp.gmail.com",
    port: 465,
    username: gmailUser,
    password: gmailPass,
  });

  await client.send({
    from: gmailUser,
    to: notificationEmail,
    subject: `💰 Nuevo pago: ${serviceName}`,
    content: `Nuevo pago de servicio recibido`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:20px;">
        <h2 style="color:#16a34a;">💰 Nuevo Pago Recibido</h2>
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:8px;font-weight:bold;">Servicio:</td><td style="padding:8px;">${serviceName}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;">Monto:</td><td style="padding:8px;">$${(amount / 100).toFixed(2)} USD</td></tr>
          <tr><td style="padding:8px;font-weight:bold;">Cliente:</td><td style="padding:8px;">${customerEmail}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;">Fecha:</td><td style="padding:8px;">${now}</td></tr>
        </table>
      </div>
    `,
  });

  await client.close();
  logStep("Notification email sent", { to: notificationEmail, service: serviceName });
}

serve(async (req) => {
  try {
    logStep("Webhook received");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    if (!stripeKey || !webhookSecret) throw new Error("Missing Stripe env vars");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");
    if (!signature) throw new Error("No signature");

    const event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    logStep("Event verified", { type: event.type });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as any;
        const customerId = session.customer;
        const subscriptionId = session.subscription;
        const tenantId = session.metadata?.tenant_id;

        if (!tenantId) {
          // Landing page service payment — send notification
          logStep("Service payment detected (no tenant_id)");
          try {
            const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 5 });
            const priceId = lineItems.data[0]?.price?.id || "";
            const serviceName = SERVICE_NAMES[priceId] || lineItems.data[0]?.description || "Servicio desconocido";
            const customerEmail = session.customer_details?.email || session.customer_email || "N/A";
            const amountTotal = session.amount_total || 0;

            await sendNotificationEmail(serviceName, amountTotal, customerEmail);
            logStep("Service payment notification sent", { service: serviceName, email: customerEmail });
          } catch (emailErr) {
            logStep("Failed to send notification email", { error: String(emailErr) });
          }
          break;
        }

        // TMS subscription checkout
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const priceId = subscription.items.data[0]?.price?.id;
        const planConfig = PLAN_LIMITS[priceId] || { max_drivers: 5, max_loads: -1, plan: "basic" };

        const trialEnd = subscription.trial_end
          ? new Date(subscription.trial_end * 1000).toISOString()
          : null;

        const periodEnd = new Date(subscription.current_period_end * 1000).toISOString();

        const { error } = await supabase
          .from("tenants")
          .update({
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            subscription_status: subscription.status,
            current_plan: planConfig.plan,
            trial_ends_at: trialEnd,
            subscription_ends_at: periodEnd,
            max_drivers: planConfig.max_drivers,
            max_loads: planConfig.max_loads,
          })
          .eq("id", tenantId);

        if (error) logStep("Error updating tenant", { error: error.message });
        else logStep("Tenant updated after checkout", { tenantId, plan: planConfig.plan });
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as any;
        const customerId = subscription.customer;
        const priceId = subscription.items.data[0]?.price?.id;
        const planConfig = PLAN_LIMITS[priceId] || { max_drivers: 5, max_loads: -1, plan: "basic" };
        const periodEnd = new Date(subscription.current_period_end * 1000).toISOString();

        const { data: tenant } = await supabase
          .from("tenants")
          .select("id")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();

        if (tenant) {
          await supabase
            .from("tenants")
            .update({
              subscription_status: subscription.status,
              current_plan: planConfig.plan,
              subscription_ends_at: periodEnd,
              max_drivers: planConfig.max_drivers,
              max_loads: planConfig.max_loads,
            })
            .eq("id", tenant.id);

          logStep("Subscription updated", { tenantId: tenant.id, status: subscription.status });
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as any;
        const customerId = invoice.customer;

        const { data: tenant } = await supabase
          .from("tenants")
          .select("id")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();

        if (tenant) {
          await supabase
            .from("tenants")
            .update({ subscription_status: "suspended" })
            .eq("id", tenant.id);

          logStep("Tenant suspended due to payment failure", { tenantId: tenant.id });
        }
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as any;
        const customerId = invoice.customer;

        const { data: tenant } = await supabase
          .from("tenants")
          .select("id")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();

        if (tenant) {
          await supabase
            .from("tenants")
            .update({ subscription_status: "active" })
            .eq("id", tenant.id);

          logStep("Tenant reactivated after payment", { tenantId: tenant.id });
        }
        break;
      }

      default:
        logStep("Unhandled event type", { type: event.type });
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      headers: { "Content-Type": "application/json" },
      status: 400,
    });
  }
});