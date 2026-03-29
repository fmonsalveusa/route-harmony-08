import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Star, Zap, Shield, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import logoImg from '@/assets/logo.png';
import bannerImg from '@/assets/dispatch-up-banner.png';

const PLANS = [
  {
    id: 'basic',
    name: 'Basic',
    price: 49,
    priceId: 'price_1T9m2l75IaXwYE4pcdPsFO9n',
    icon: Truck,
    features: [
      'Hasta 5 drivers',
      'Cargas ilimitadas',
      'GPS básico',
      'Soporte por email',
      'Dashboard completo',
      'Facturación y pagos',
    ],
    popular: false,
    maxDrivers: 5,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 99,
    priceId: 'price_1T9m4a75IaXwYE4pPWVH3AAN',
    icon: Zap,
    features: [
      'Hasta 20 drivers',
      'Cargas ilimitadas',
      'GPS en tiempo real',
      'Reportes avanzados',
      'Soporte prioritario',
      'Dashboard completo',
      'Facturación y pagos',
    ],
    popular: true,
    maxDrivers: 20,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 149,
    priceId: 'price_1T9m5t75IaXwYE4pS3HDd67D',
    icon: Shield,
    features: [
      'Drivers ilimitados',
      'Cargas ilimitadas',
      'API access',
      'White label',
      'Soporte dedicado',
      'GPS en tiempo real',
      'Reportes avanzados',
      'Dashboard completo',
    ],
    popular: false,
    maxDrivers: -1,
  },
];

const Pricing = () => {
  const navigate = useNavigate();

  const handleSelectPlan = (planId: string, priceId: string) => {
    navigate(`/register?plan=${planId}&priceId=${priceId}`);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex h-16 items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
            <img src={logoImg} alt="Dispatch Up" className="h-9 w-9 rounded-lg object-cover" />
            <span className="text-xl font-bold text-foreground">Dispatch Up</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => navigate('/auth')}>
              Iniciar sesión
            </Button>
          </div>
        </div>
      </nav>

      {/* Banner */}
      <div className="w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 overflow-hidden">
        <div className="max-w-7xl mx-auto flex items-center justify-center py-6 px-4">
          <img src={bannerImg} alt="Dispatch Up TMS" className="h-16 md:h-20 object-contain" />
        </div>
      </div>

      {/* Hero */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-8 text-center">
        <Badge variant="secondary" className="mb-4 text-sm px-4 py-1.5">
          <Star className="h-3.5 w-3.5 mr-1.5" /> 7 días de prueba gratis
        </Badge>
        <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
          Planes diseñados para tu flota
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Gestiona tu operación de transporte con las herramientas que necesitas.
          Todos los planes incluyen 7 días de prueba gratuita.
        </p>
      </div>

      {/* Plans */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {PLANS.map((plan) => {
            const Icon = plan.icon;
            return (
              <Card
                key={plan.id}
                className={`relative flex flex-col transition-all hover:shadow-lg ${
                  plan.popular
                    ? 'border-primary shadow-md scale-[1.02]'
                    : 'border-border'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground px-4 py-1">
                      Más popular
                    </Badge>
                  </div>
                )}
                <CardHeader className="text-center pt-8 pb-2">
                  <div className={`mx-auto mb-3 p-3 rounded-xl ${plan.popular ? 'bg-primary/10' : 'bg-muted'}`}>
                    <Icon className={`h-7 w-7 ${plan.popular ? 'text-primary' : 'text-muted-foreground'}`} />
                  </div>
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <div className="mt-4">
                    <span className="text-4xl font-bold text-foreground">${plan.price}</span>
                    <span className="text-muted-foreground">/mes</span>
                  </div>
                  <CardDescription className="mt-2">
                    <Badge variant="outline" className="text-xs">
                      7 días gratis
                    </Badge>
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <ul className="space-y-3 flex-1 mb-6">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2.5">
                        <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full"
                    variant={plan.popular ? 'default' : 'outline'}
                    size="lg"
                    onClick={() => handleSelectPlan(plan.id, plan.priceId)}
                  >
                    Empezar trial gratis
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Pricing;
