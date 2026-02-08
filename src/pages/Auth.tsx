import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Truck, Mail, Lock, AlertCircle, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const Auth = () => {
  const { user, loading, signIn, signUp, isMasterAdmin } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [signUpSuccess, setSignUpSuccess] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (user) {
    return <Navigate to={isMasterAdmin ? '/master' : '/'} replace />;
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    const { error } = await signIn(email, password);
    if (error) {
      if (error.message.includes('Invalid login')) {
        setError('Credenciales inválidas. Verifica tu email y contraseña.');
      } else if (error.message.includes('Email not confirmed')) {
        setError('Debes confirmar tu email antes de iniciar sesión.');
      } else {
        setError(error.message);
      }
    }
    setIsLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    setIsLoading(true);
    const { error } = await signUp(email, password, fullName);
    if (error) {
      if (error.message.includes('already registered')) {
        setError('Este email ya está registrado. Intenta iniciar sesión.');
      } else {
        setError(error.message);
      }
    } else {
      setSignUpSuccess(true);
    }
    setIsLoading(false);
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
            Plataforma integral de gestión de transporte multi-empresa. Controla tu flota, cargas, pagos y equipo.
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

          {signUpSuccess ? (
            <Card className="border-0 shadow-lg">
              <CardHeader className="pb-4 text-center">
                <CardTitle className="text-xl text-success">¡Registro exitoso!</CardTitle>
                <CardDescription>
                  Hemos enviado un email de confirmación a <strong>{email}</strong>. Por favor, confirma tu email para iniciar sesión.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" onClick={() => { setSignUpSuccess(false); setError(''); }}>
                  Volver a Iniciar Sesión
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-0 shadow-lg">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl">Bienvenido</CardTitle>
                <CardDescription>Accede a tu cuenta o regístrate</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="login">
                  <TabsList className="grid w-full grid-cols-2 mb-4">
                    <TabsTrigger value="login">Iniciar Sesión</TabsTrigger>
                    <TabsTrigger value="register">Registrarse</TabsTrigger>
                  </TabsList>

                  <TabsContent value="login">
                    <form onSubmit={handleSignIn} className="space-y-4">
                      {error && (
                        <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                          <AlertCircle className="h-4 w-4 flex-shrink-0" />
                          {error}
                        </div>
                      )}
                      <div className="space-y-2">
                        <Label htmlFor="login-email">Email</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input id="login-email" type="email" placeholder="tu@email.com" value={email} onChange={e => setEmail(e.target.value)} className="pl-10" required />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="login-password">Contraseña</Label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input id="login-password" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} className="pl-10" required />
                        </div>
                      </div>
                      <Button type="submit" className="w-full" disabled={isLoading}>
                        {isLoading ? 'Ingresando...' : 'Ingresar'}
                      </Button>
                    </form>
                  </TabsContent>

                  <TabsContent value="register">
                    <form onSubmit={handleSignUp} className="space-y-4">
                      {error && (
                        <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                          <AlertCircle className="h-4 w-4 flex-shrink-0" />
                          {error}
                        </div>
                      )}
                      <div className="space-y-2">
                        <Label htmlFor="reg-name">Nombre completo</Label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input id="reg-name" placeholder="Tu nombre" value={fullName} onChange={e => setFullName(e.target.value)} className="pl-10" required />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="reg-email">Email</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input id="reg-email" type="email" placeholder="tu@email.com" value={email} onChange={e => setEmail(e.target.value)} className="pl-10" required />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="reg-password">Contraseña</Label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input id="reg-password" type="password" placeholder="Mínimo 6 caracteres" value={password} onChange={e => setPassword(e.target.value)} className="pl-10" required minLength={6} />
                        </div>
                      </div>
                      <Button type="submit" className="w-full" disabled={isLoading}>
                        {isLoading ? 'Registrando...' : 'Crear cuenta'}
                      </Button>
                    </form>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default Auth;
