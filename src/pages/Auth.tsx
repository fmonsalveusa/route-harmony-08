import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Truck, Mail, Lock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const Auth = () => {
  const { user, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  if (user) return <Navigate to="/" replace />;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!login(email, password)) {
      setError('Credenciales inválidas. Prueba con uno de los emails de demostración.');
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary flex-col justify-center items-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary to-accent opacity-90" />
        <div className="relative z-10 text-center">
          <Truck className="h-20 w-20 text-primary-foreground mb-6 mx-auto" />
          <h1 className="text-4xl font-bold text-primary-foreground mb-4">TruckFlow TMS</h1>
          <p className="text-primary-foreground/80 text-lg max-w-md">
            Sistema integral de gestión de transporte. Controla tu flota, cargas, pagos y equipo desde un solo lugar.
          </p>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-primary/50 to-transparent" />
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center justify-center mb-8">
            <Truck className="h-10 w-10 text-primary mr-3" />
            <h1 className="text-2xl font-bold text-foreground">TruckFlow</h1>
          </div>

          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl">Iniciar Sesión</CardTitle>
              <CardDescription>Ingresa tus credenciales para acceder al sistema</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    {error}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="admin@tms.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
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
                      placeholder="••••••••"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full">
                  Ingresar
                </Button>
              </form>

              <div className="mt-6 p-4 rounded-lg bg-muted">
                <p className="text-xs font-medium text-muted-foreground mb-2">Cuentas de demostración:</p>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <p><span className="font-semibold text-foreground">Admin:</span> admin@tms.com</p>
                  <p><span className="font-semibold text-foreground">Contabilidad:</span> accounting@tms.com</p>
                  <p><span className="font-semibold text-foreground">Dispatcher:</span> dispatcher@tms.com</p>
                </div>
                <p className="text-xs text-muted-foreground mt-2 italic">Cualquier contraseña funciona</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Auth;
