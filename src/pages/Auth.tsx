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
    try {
      const { error } = await signIn(email, password);
      if (error) {
        if (error.message.includes('Failed to fetch')) {
          // Clear stale session that causes infinite refresh loops
          try { localStorage.removeItem('sb-rycwycqlbfcnkjiqmzyt-auth-token'); } catch {}
          setError('Connection error. Please try using the published app URL or reload the page.');
        } else if (error.message.includes('Invalid login')) {
          setError('Invalid credentials. Please check your email and password.');
        } else if (error.message.includes('Email not confirmed')) {
          setError('Please confirm your email before signing in.');
        } else {
          setError(error.message);
        }
      }
    } catch (err: any) {
      if (err?.message?.includes('Failed to fetch')) {
        try { localStorage.removeItem('sb-rycwycqlbfcnkjiqmzyt-auth-token'); } catch {}
        setError('Connection error. Please try using the published app URL or reload the page.');
      } else {
        setError(err?.message || 'An unexpected error occurred.');
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

  const FIELD = 'h-12 pl-11 rounded-xl bg-white dark:bg-card border-[#747775] dark:border-border shadow-none text-[15px] focus-visible:ring-0 focus-visible:border-2 focus-visible:border-[#0b57d0]';

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f0f4f9] dark:bg-background p-4">
      {/* Tarjeta de acceso estilo Google */}
      <div className="w-full max-w-[1040px] rounded-[28px] bg-white dark:bg-card p-8 sm:p-10 grid gap-8 md:grid-cols-2">
        <div className="flex flex-col">
          <img src={logoImg} alt="Dispatch Up TMS" className="h-12 w-12 rounded-xl object-cover" />
          <h1 className="mt-6 text-[36px] leading-[44px] font-normal text-[#1f1f1f] dark:text-foreground">
            {signUpSuccess ? 'Revisa tu email' : 'Sign in'}
          </h1>
          <p className="mt-3 text-base text-[#1f1f1f] dark:text-foreground">
            {signUpSuccess ? 'Te enviamos un correo de confirmación' : 'to continue to Dispatch Up TMS'}
          </p>
          <p className="mt-auto pt-8 hidden md:block text-sm text-[#444746] dark:text-muted-foreground max-w-sm">
            Comprehensive multi-company transportation management platform. Manage your fleet, loads, payments, and team.
          </p>
        </div>

        <div className="flex flex-col justify-center">
          {signUpSuccess ? (
            <div className="space-y-6">
              <p className="text-sm text-[#444746] dark:text-muted-foreground">
                We have sent a confirmation email to <strong className="text-[#1f1f1f] dark:text-foreground">{email}</strong>. Please confirm your email to sign in.
              </p>
              <div className="flex justify-end">
                <Button className="h-10 rounded-full px-6 bg-[#0b57d0] hover:bg-[#0842a0] text-white font-medium shadow-none" onClick={() => { setSignUpSuccess(false); setError(''); }}>
                  Back to Sign In
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSignIn} className="space-y-5">
              {error && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-[#fce8e6] dark:bg-red-950/40 text-[#a50e0e] dark:text-red-300 text-sm">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {error}
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="login-email" className="text-xs font-medium text-[#444746] dark:text-muted-foreground">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#444746] dark:text-muted-foreground" />
                  <Input id="login-email" type="email" placeholder="you@email.com" value={email} onChange={e => setEmail(e.target.value)} className={FIELD} required />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="login-password" className="text-xs font-medium text-[#444746] dark:text-muted-foreground">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#444746] dark:text-muted-foreground" />
                  <Input id="login-password" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} className={FIELD} required />
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <Button type="submit" className="h-10 rounded-full px-6 bg-[#0b57d0] hover:bg-[#0842a0] text-white font-medium shadow-none" disabled={isLoading}>
                  {isLoading ? 'Signing in...' : 'Sign In'}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default Auth;
