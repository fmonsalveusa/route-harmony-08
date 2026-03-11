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

    const checkoutWindow = priceId ? window.open('', '_blank') : null;

    if (checkoutWindow) {
      checkoutWindow.document.write(`
        <html>
          <head><title>Redirecting to checkout...</title></head>
          <body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;">
            <p>Redirecting to secure checkout...</p>
          </body>
        </html>
      `);
      checkoutWindow.document.close();
    }

    setIsLoading(true);

    try {
      // Call edge function that handles everything server-side
      const { data, error: fnError } = await supabase.functions.invoke(
        'register-tenant',
        {
          body: {
            email,
            password,
            fullName,
            companyName,
            plan,
            priceId,
          },
        }
      );

      if (fnError) {
        checkoutWindow?.close();
        console.error('Registration function error:', fnError);
        setError('Error en el registro. Intenta de nuevo.');
        setIsLoading(false);
        return;
      }

      if (data?.error) {
        checkoutWindow?.close();
        setError(data.error);
        setIsLoading(false);
        return;
      }

      // Open Stripe outside the preview iframe to avoid embedded checkout freezes
      if (data?.checkoutUrl) {
        if (checkoutWindow) {
          checkoutWindow.location.replace(data.checkoutUrl);
        } else {
          window.location.href = data.checkoutUrl;
        }

        toast.success(
          data?.resumedExistingAccount
            ? 'Continuando tu registro en una nueva pestaña...'
            : 'Checkout abierto en una nueva pestaña.'
        );
        setIsLoading(false);
        return;
      }

      checkoutWindow?.close();

      if (data?.resumedExistingAccount) {
        toast.success('Tu cuenta ya existe. Inicia sesión para continuar.');
        navigate('/auth');
        setIsLoading(false);
        return;
      }

      // No checkout URL (Stripe not configured) — sign in and go to dashboard
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        toast.success('¡Cuenta creada! Inicia sesión con tus credenciales.');
        navigate('/auth');
        setIsLoading(false);
        return;
      }
      toast.success('¡Cuenta creada exitosamente!');
      navigate('/dashboard');
      setIsLoading(false);
    } catch (err: any) {
      checkoutWindow?.close();
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
                      disabled={isLoading}
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
                      disabled={isLoading}
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
                      disabled={isLoading}
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
                      disabled={isLoading}
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
