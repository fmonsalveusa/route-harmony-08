import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { KeyRound, Copy, Check, Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { generateDefaultPassword } from '@/lib/passwordUtils';

type AccessRole = 'driver' | 'dispatcher' | 'investor';

interface Props {
  name: string;
  email: string | null;
  phone?: string | null;
  role: AccessRole;
  /** Estilo del botón — 'row' para tablas, 'default' para formularios */
  variant?: 'row' | 'default';
}

export function CreateAccessButton({ name, email, phone, role, variant = 'row' }: Props) {
  const [creating, setCreating] = useState(false);
  const [checking, setChecking] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [copied, setCopied] = useState(false);
  const password = generateDefaultPassword(name);

  // Verificar si ya existe un usuario con ese email
  useEffect(() => {
    if (!email) { setChecking(false); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .ilike('email', email)
        .maybeSingle();
      if (!cancelled) {
        setHasAccess(!!data);
        setChecking(false);
      }
    })();
    return () => { cancelled = true; };
  }, [email]);

  const handleCreate = async () => {
    if (!email) {
      toast.error('Este registro no tiene email — agrégalo primero');
      return;
    }
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-user', {
        body: {
          action: 'create',
          email,
          password,
          full_name: name,
          phone: phone || null,
          role,
        },
      });

      if (error) {
        let msg = 'Error creando el acceso';
        if (error?.context?.body) {
          try { const b = JSON.parse(error.context.body); if (b.error) msg = b.error; } catch {}
        } else if (error?.message) msg = error.message;
        throw new Error(msg);
      }
      if (data?.error) throw new Error(data.error);

      setHasAccess(true);
      setShowResult(true);
    } catch (err: any) {
      const msg = err.message || '';
      // Error típico cuando el email ya está registrado en auth
      if (msg.toLowerCase().includes('already') || msg.toLowerCase().includes('registered')) {
        toast.error('Ya existe un usuario con ese email');
        setHasAccess(true);
      } else {
        toast.error(msg || 'Error creando el acceso');
      }
    } finally {
      setCreating(false);
    }
  };

  const copyCredentials = () => {
    navigator.clipboard.writeText(`Usuario: ${email}\nContraseña: ${password}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (checking) return null;

  // Ya tiene acceso → mostrar indicador, no botón
  if (hasAccess && !showResult) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium" title="Ya tiene acceso a la app">
        <ShieldCheck className="h-3.5 w-3.5" /> Con acceso
      </span>
    );
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className={variant === 'row' ? 'h-7 px-2 text-xs gap-1 text-violet-600 hover:text-violet-700 hover:bg-violet-50' : 'gap-1.5'}
        onClick={handleCreate}
        disabled={creating || !email}
        title={!email ? 'Requiere email' : 'Crear acceso a la app móvil'}
      >
        {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
        {creating ? 'Creando...' : 'Crear acceso'}
      </Button>

      {/* Resultado con credenciales */}
      <Dialog open={showResult} onOpenChange={setShowResult}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-green-600" /> Acceso creado
            </DialogTitle>
            <DialogDescription>
              Comparte estas credenciales con {name.split(' ')[0]}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="rounded-lg border bg-muted/40 p-3 space-y-2 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Usuario</p>
                <p className="font-mono font-medium break-all">{email}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Contraseña</p>
                <p className="font-mono font-bold text-base">{password}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="w-full gap-1.5" onClick={copyCredentials}>
              {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copiado' : 'Copiar credenciales'}
            </Button>
          </div>

          <DialogFooter>
            <Button onClick={() => setShowResult(false)}>Listo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
