import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  CreditCard, Users, Package, Calendar, Shield, Zap, Truck,
  ArrowUpRight, Check, AlertTriangle, Loader2, Crown
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  active: { label: 'Activa', variant: 'default' },
  trialing: { label: 'Trial', variant: 'secondary' },
  past_due: { label: 'Pago pendiente', variant: 'destructive' },
  suspended: { label: 'Suspendida', variant: 'destructive' },
  canceled: { label: 'Cancelada', variant: 'outline' },
  pending: { label: 'Pendiente', variant: 'outline' },
};

const PLAN_FEATURES: Record<string, string[]> = {
  basic: ['Hasta 5 drivers', 'Cargas ilimitadas', 'GPS básico', 'Soporte email'],
  pro: ['Hasta 20 drivers', 'Cargas ilimitadas', 'GPS en tiempo real', 'Reportes avanzados', 'Soporte prioritario'],
  enterprise: ['Drivers ilimitados', 'Cargas ilimitadas', 'API access', 'White label', 'Soporte dedicado'],
};

const Subscription = () => {
  const { profile, tenant } = useAuth();
  const {
    subscription, activeDriverCount, loading,
    getPlanLabel, getPlanPrice, isTrialing, isActive,
    isSuspended, openCustomerPortal
  } = useSubscription();

  const [portalLoading, setPortalLoading] = useState(false);

  const handleManageBilling = async () => {
    setPortalLoading(true);
    const url = await openCustomerPortal();
    if (url) {
      window.open(url, '_blank');
    } else {
      toast.error('Error al abrir el portal de facturación. Verifica que tengas una suscripción activa.');
    }
    setPortalLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const status = subscription?.subscription_status || 'pending';
  const statusInfo = STATUS_LABELS[status] || STATUS_LABELS.pending;
  const maxDrivers = subscription?.max_drivers || 5;
  const driverPercent = maxDrivers === -1 ? 0 : Math.round((activeDriverCount / maxDrivers) * 100);
  const features = PLAN_FEATURES[subscription?.current_plan || 'basic'] || PLAN_FEATURES.basic;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title flex items-center gap-2">
          <CreditCard className="h-6 w-6" /> Suscripción
        </h1>
        <p className="page-description">Gestiona tu plan y facturación</p>
      </div>

      {/* Status banner */}
      {isSuspended() && (
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0" />
          <div>
            <p className="font-semibold text-destructive">Suscripción suspendida</p>
            <p className="text-sm text-muted-foreground">
              Tu cuenta está suspendida por un pago fallido. Actualiza tu método de pago para reactivarla.
            </p>
          </div>
          <Button size="sm" variant="destructive" className="ml-auto" onClick={handleManageBilling}>
            Actualizar pago
          </Button>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        {/* Plan actual */}
        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Crown className="h-5 w-5 text-primary" />
                  Plan {getPlanLabel()}
                </CardTitle>
                <CardDescription>
                  {isTrialing() ? 'Período de prueba' : 'Suscripción activa'}
                </CardDescription>
              </div>
              <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-bold text-foreground">${getPlanPrice()}</span>
              <span className="text-muted-foreground">/mes</span>
            </div>

            <Separator />

            {/* Usage */}
            <div className="space-y-4">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <Users className="h-4 w-4" /> Uso actual
              </h3>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Drivers activos</span>
                  <span className="text-sm font-medium text-foreground">
                    {activeDriverCount} / {maxDrivers === -1 ? '∞' : maxDrivers}
                  </span>
                </div>
                {maxDrivers !== -1 && (
                  <Progress value={driverPercent} className="h-2" />
                )}
                {maxDrivers !== -1 && driverPercent >= 80 && (
                  <p className="text-xs text-warning mt-1">
                    ⚠ Estás cerca del límite de drivers
                  </p>
                )}
              </div>
            </div>

            <Separator />

            {/* Features */}
            <div className="space-y-3">
              <h3 className="font-semibold text-foreground">Incluye:</h3>
              <ul className="space-y-2">
                {features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check className="h-4 w-4 text-primary flex-shrink-0" /> {f}
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Billing dates */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4" /> Fechas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isTrialing() && subscription?.trial_ends_at && (
                <div>
                  <p className="text-xs text-muted-foreground">Trial termina</p>
                  <p className="text-sm font-medium text-foreground">
                    {format(new Date(subscription.trial_ends_at), 'dd MMM yyyy')}
                  </p>
                </div>
              )}
              {subscription?.subscription_ends_at && (
                <div>
                  <p className="text-xs text-muted-foreground">Próximo pago</p>
                  <p className="text-sm font-medium text-foreground">
                    {format(new Date(subscription.subscription_ends_at), 'dd MMM yyyy')}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4" /> Acciones
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                className="w-full gap-2"
                variant="outline"
                onClick={handleManageBilling}
                disabled={portalLoading}
              >
                {portalLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowUpRight className="h-4 w-4" />
                )}
                Actualizar plan
              </Button>
              <Button
                className="w-full gap-2"
                variant="ghost"
                onClick={handleManageBilling}
                disabled={portalLoading}
              >
                <CreditCard className="h-4 w-4" /> Gestionar facturación
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Subscription;
