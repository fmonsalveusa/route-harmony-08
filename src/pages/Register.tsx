import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Building2, Mail, Lock, User, ArrowLeft, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import logoImg from '@/assets/logo.png';

const PLAN_NAMES: Record<string, string> = {
  basic: 'Basic — $49/mes',
  pro: 'Pro — $99/mes',
  enterprise: 'Enterprise — $149/mes',
};

const Register = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const plan = searchParams.get('plan') || 'basic';
  const priceId = searchParams.get('priceId') || '';

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (!companyName.trim()) {
      setError('El nombre de la empresa es requerido.');
      return;
    }

    setIsLoading(true);

    try {
      // 1. Create user in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
        },
      });

      if (authError) {
        if (authError.message.includes('already registered')) {
          setError('Este email ya está registrado. Intenta iniciar sesión.');
        } else {
          setError(authError.message);
        }
        setIsLoading(false);
        return;
      }

      const userId = authData.user?.id;
      if (!userId) {
        setError('Error creando la cuenta.');
        setIsLoading(false);
        return;
      }

      // 2. Create tenant
      const { data: tenantData, error: tenantError } = await supabase
        .from('tenants')
        .insert({
          name: companyName,
          current_plan: plan,
          subscription_status: 'pending',
        } as any)
        .select('id')
        .single();

      if (tenantError) {
        console.error('Tenant creation error:', tenantError);
        setError('Error creando la empresa. Intenta de nuevo.');
        setIsLoading(false);
        return;
      }

      const tenantId = tenantData.id;

      // 3. Update profile with tenant_id
      await supabase
        .from('profiles')
        .update({ tenant_id: tenantId } as any)
        .eq('id', userId);

      // 4. Assign admin role
      await supabase
        .from('user_roles')
        .insert({ user_id: userId, role: 'admin', tenant_id: tenantId } as any);

      // 5. Create company record
      await supabase
        .from('companies')
        .insert({
          name: companyName,
          tenant_id: tenantId,
          is_primary: true,
        } as any);

      // 6. Redirect to Stripe Checkout
      const { data: checkoutData, error: checkoutError } = await supabase.functions.invoke(
        'create-checkout',
        {
          body: {
            priceId,
            tenantId,
            email,
            companyName,
          },
        }
      );

      if (checkoutError || !checkoutData?.url) {
        console.error('Checkout error:', checkoutError, checkoutData);
        toast.error('Error conectando con el sistema de pagos. Tu cuenta fue creada, inicia sesión y configura tu suscripción.');
        navigate('/auth');
        return;
      }

      // Redirect to Stripe
      window.location.href = checkoutData.url;
    } catch (err: any) {
      console.error('Registration error:', err);
      setError('Error inesperado. Intenta de nuevo.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary flex-col justify-center items-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary to-accent opacity-90" />
        <div className="relative z-10 text-center">
          <img src={logoImg} alt="Dispatch Up" className="h-20 w-20 mb-6 mx-auto rounded-xl object-cover" />
          <h1 className="text-4xl font-bold text-primary-foreground mb-4">Dispatch Up TMS</h1>
          <p className="text-primary-foreground/80 text-lg max-w-md">
            Crea tu cuenta y empieza tu trial de 7 días gratis. Sin compromisos.
          </p>
          <div className="mt-8 p-4 bg-primary-foreground/10 rounded-xl">
            <p className="text-primary-foreground font-semibold text-lg">
              Plan: {PLAN_NAMES[plan] || plan}
            </p>
            <p className="text-primary-foreground/70 text-sm mt-1">7 días de prueba gratis</p>
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <Button variant="ghost" className="mb-6" onClick={() => navigate('/pricing')}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Volver a planes
          </Button>

          <div className="lg:hidden mb-6 text-center">
            <img src={logoImg} alt="Dispatch Up" className="h-10 w-10 rounded-lg mx-auto mb-2 object-cover" />
            <p className="text-sm text-muted-foreground">Plan: {PLAN_NAMES[plan] || plan}</p>
          </div>

          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl">Crear cuenta</CardTitle>
              <CardDescription>Completa tus datos para iniciar tu trial gratuito</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleRegister} className="space-y-4">
                {error && (
                  <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    {error}
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="fullName">Nombre completo</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="fullName"
                      placeholder="Tu nombre"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyName">Nombre de la empresa</Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="companyName"
                      placeholder="Mi empresa de transporte"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="tu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Contraseña</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="Mínimo 6 caracteres"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10"
                      required
                      minLength={6}
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creando cuenta...
                    </>
                  ) : (
                    'Empezar trial gratis'
                  )}
                </Button>
                <p className="text-xs text-muted-foreground text-center mt-3">
                  Se requiere tarjeta de crédito. No se cobra durante los 7 días de prueba.
                  Al registrarte aceptas nuestros términos de servicio.
                </p>
              </form>
            </CardContent>
          </Card>

          <p className="text-sm text-muted-foreground text-center mt-4">
            ¿Ya tienes cuenta?{' '}
            <button onClick={() => navigate('/auth')} className="text-primary hover:underline font-medium">
              Inicia sesión
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
