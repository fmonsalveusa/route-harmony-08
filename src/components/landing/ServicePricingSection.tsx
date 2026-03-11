import { useState } from "react";
import { MessageCircle, DollarSign, CreditCard, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { ServicePricing, StripeConfig } from "./servicesData";

interface ServicePricingSectionProps {
  pricing: ServicePricing;
  whatsappHref: string;
  onClose: () => void;
  stripeConfig?: StripeConfig;
}

export function ServicePricingSection({ pricing, whatsappHref, onClose, stripeConfig }: ServicePricingSectionProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleStripeCheckout = async () => {
    if (!stripeConfig) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-service-checkout", {
        body: { priceId: stripeConfig.priceId, mode: stripeConfig.mode },
      });
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (err: any) {
      toast.error("Error al iniciar el pago. Intenta de nuevo.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (pricing.type === "page") {
    return (
      <Button
        className="w-full gap-2"
        onClick={() => {
          onClose();
          navigate(pricing.pricingPath || "/pricing");
        }}
      >
        <DollarSign size={18} />
        Ver Precios
      </Button>
    );
  }

  if (pricing.type === "fixed" && pricing.fixedPrice) {
    const { amount, period, note } = pricing.fixedPrice;
    return (
      <div className="space-y-3">
        <div className="rounded-xl border bg-muted/30 p-5 text-center space-y-2">
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-3xl font-bold text-foreground">${amount.toLocaleString()}</span>
            <span className="text-sm text-muted-foreground">{period}</span>
          </div>
          {note && <p className="text-xs text-muted-foreground">{note}</p>}
        </div>
        {stripeConfig && (
          <Button className="w-full gap-2" onClick={handleStripeCheckout} disabled={loading}>
            {loading ? <Loader2 size={18} className="animate-spin" /> : <CreditCard size={18} />}
            Pagar Ahora
          </Button>
        )}
      </div>
    );
  }

  if (pricing.type === "plans" && pricing.plans) {
    return (
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          {pricing.plans.map((plan) => (
            <div key={plan.name} className="rounded-xl border bg-muted/30 p-4 space-y-2">
              <p className="font-semibold text-foreground text-sm">{plan.name}</p>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-foreground">${plan.price.toLocaleString()}</span>
                <span className="text-xs text-muted-foreground">{plan.period}</span>
              </div>
              <ul className="space-y-1 pt-1">
                {plan.features.map((f) => (
                  <li key={f} className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <span className="text-accent mt-0.5">•</span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        {stripeConfig && (
          <Button className="w-full gap-2" onClick={handleStripeCheckout} disabled={loading}>
            {loading ? <Loader2 size={18} className="animate-spin" /> : <CreditCard size={18} />}
            Pagar Ahora
          </Button>
        )}
      </div>
    );
  }

  return null;
}
