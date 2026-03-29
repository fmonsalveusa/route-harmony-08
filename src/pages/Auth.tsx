import { useState } from 'react';
import logoImg from '@/assets/logo.png';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Truck, Mail, Lock, AlertCircle, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const Auth = () => {
  const { user, loading, signIn, signUp, isMasterAdmin, role } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [signUpSuccess, setSignUpSuccess] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background text-foreground">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-muted border-t-foreground" />
        <p className="text-sm text-muted-foreground">Conectando...</p>
      </div>
    );
  }

  if (user && role) {
    const redirectPath = isMasterAdmin ? '/master' : role === 'driver' ? '/driver' : '/dashboard';
    return <Navigate to={redirectPath} replace />;
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    const { error } = await signIn(email, password);
    if (error) {
      if (error.message.includes('Invalid login')) {
        setError('Invalid credentials. Please check your email and password.');
      } else if (error.message.includes('Email not confirmed')) {
        setError('Please confirm your email before signing in.');
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
      setError('Password must be at least 6 characters.');
      return;
    }
    setIsLoading(true);
    const { error } = await signUp(email, password, fullName);
    if (error) {
      if (error.message.includes('already registered')) {
        setError('This email is already registered. Try signing in.');
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
          <img src={logoImg} alt="Dispatch Up TMS" className="h-20 w-20 mb-6 mx-auto rounded-xl object-cover" />
          <h1 className="text-4xl font-bold text-primary-foreground mb-4">Dispatch Up TMS</h1>
          <p className="text-primary-foreground/80 text-lg max-w-md">
            Comprehensive multi-company transportation management platform. Manage your fleet, loads, payments, and team.
          </p>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-primary/50 to-transparent" />
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center justify-center mb-8">
            <img src={logoImg} alt="Dispatch Up TMS" className="h-10 w-10 rounded-lg mr-3 flex-shrink-0 object-cover" />
            <h1 className="text-2xl font-bold text-foreground">Dispatch Up TMS</h1>
          </div>

          {signUpSuccess ? (
            <Card className="border-0 shadow-lg">
              <CardHeader className="pb-4 text-center">
                <CardTitle className="text-xl text-success">Registration successful!</CardTitle>
                <CardDescription>
                  We have sent a confirmation email to <strong>{email}</strong>. Please confirm your email to sign in.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" onClick={() => { setSignUpSuccess(false); setError(''); }}>
                  Back to Sign In
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-0 shadow-lg">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl">Welcome</CardTitle>
                <CardDescription>Sign in to your account or register</CardDescription>
              </CardHeader>
              <CardContent>
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
                      <Input id="login-email" type="email" placeholder="you@email.com" value={email} onChange={e => setEmail(e.target.value)} className="pl-10" required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input id="login-password" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} className="pl-10" required />
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? 'Signing in...' : 'Sign In'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default Auth;
