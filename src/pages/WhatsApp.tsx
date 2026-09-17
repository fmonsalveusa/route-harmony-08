import { useCallback, useEffect, useMemo, useState } from 'react';
import { MessageCircle, RefreshCw, Search, CheckCircle2, XCircle, Loader2, Smartphone } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useDrivers } from '@/hooks/useDrivers';
import { useInvestors } from '@/hooks/useInvestors';
import { useDispatchers } from '@/hooks/useDispatchers';
import { WhatsAppGroupSelect, fetchWhatsAppGroups, type WhatsAppGroup } from '@/components/WhatsAppGroupSelect';
import { AutomationsPanel } from '@/components/whatsapp/AutomationsPanel';
import { MessageHistory } from '@/components/whatsapp/MessageHistory';
import { toast } from 'sonner';

type EntityType = 'drivers' | 'investors' | 'dispatchers';

interface Row {
  id: string;
  name: string;
  detail: string;
  inactive: boolean;
  groupId: string | null;
  groupName: string | null;
}

interface Connection {
  connected: boolean;
  status: string;
  phone: string | null;
}

const SERVICE_LABELS: Record<string, string> = {
  company_driver: 'Company Driver',
  owner_operator: 'Owner Operator',
  dispatch_service: 'Dispatch Service',
};

function GroupsTable({ rows, groups, onAssign }: {
  rows: Row[];
  groups: WhatsAppGroup[] | null;
  onAssign: (row: Row, id: string | null, name: string | null) => void;
}) {
  const [search, setSearch] = useState('');
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  const visible = rows
    .filter(r => showInactive || !r.inactive)
    .filter(r => !onlyMissing || !r.groupId)
    .filter(r => !search || r.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => Number(Boolean(a.groupId)) - Number(Boolean(b.groupId)) || a.name.localeCompare(b.name));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." className="h-8 w-48 pl-8 text-xs" />
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
          <Switch checked={onlyMissing} onCheckedChange={setOnlyMissing} className="scale-75" /> Solo sin grupo
        </label>
        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
          <Switch checked={showInactive} onCheckedChange={setShowInactive} className="scale-75" /> Mostrar inactivos
        </label>
      </div>

      <div className="rounded-lg border divide-y">
        {visible.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">Sin resultados</p>
        )}
        {visible.map(row => (
          <div key={row.id} className={`flex flex-col sm:flex-row sm:items-center gap-2 px-3 py-2 ${row.inactive ? 'opacity-60' : ''}`}>
            <div className="flex items-center gap-2 sm:w-64 min-w-0">
              {row.groupId
                ? <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                : <XCircle className="h-4 w-4 text-amber-500 flex-shrink-0" />}
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{row.name}</p>
                <p className="text-[11px] text-muted-foreground truncate">{row.detail}</p>
              </div>
            </div>
            <WhatsAppGroupSelect
              compact
              className="flex-1 min-w-0"
              groups={groups}
              groupId={row.groupId}
              groupName={row.groupName}
              onChange={(id, name) => onAssign(row, id, name)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function WhatsAppPage() {
  const { drivers, refetch: refetchDrivers } = useDrivers();
  const { investors, refetch: refetchInvestors } = useInvestors();
  const { dispatchers, refetch: refetchDispatchers } = useDispatchers();

  const [groups, setGroups] = useState<WhatsAppGroup[] | null>(null);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [checking, setChecking] = useState(false);

  const loadGroups = useCallback(async () => {
    setLoadingGroups(true);
    try {
      setGroups(await fetchWhatsAppGroups());
    } catch (e: any) {
      toast.error(`No se pudieron cargar los grupos: ${e.message}`);
    } finally {
      setLoadingGroups(false);
    }
  }, []);

  const checkConnection = useCallback(async () => {
    setChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-groups', { body: { action: 'status' } });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      setConnection(data);
    } catch (e: any) {
      setConnection({ connected: false, status: e.message, phone: null });
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void checkConnection();
    void loadGroups();
  }, [checkConnection, loadGroups]);

  const rows = useMemo(() => ({
    drivers: drivers.map((d: any): Row => ({
      id: d.id,
      name: d.name,
      detail: [SERVICE_LABELS[d.service_type] || d.service_type, d.status].filter(Boolean).join(' · '),
      inactive: d.status === 'inactive',
      groupId: d.whatsapp_group_id ?? null,
      groupName: d.whatsapp_group_name ?? null,
    })),
    investors: investors.map((i: any): Row => ({
      id: i.id,
      name: i.name,
      detail: i.business_name || i.email || '',
      inactive: i.status === 'inactive',
      groupId: i.whatsapp_group_id ?? null,
      groupName: i.whatsapp_group_name ?? null,
    })),
    dispatchers: dispatchers.map((d: any): Row => ({
      id: d.id,
      name: d.name,
      detail: d.status || '',
      inactive: d.status === 'inactive',
      groupId: d.whatsapp_group_id ?? null,
      groupName: d.whatsapp_group_name ?? null,
    })),
  }), [drivers, investors, dispatchers]);

  const assign = async (type: EntityType, row: Row, id: string | null, name: string | null) => {
    const { error } = await supabase
      .from(type as any)
      .update({ whatsapp_group_id: id, whatsapp_group_name: name } as any)
      .eq('id', row.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(id ? `${row.name}: grupo asignado` : `${row.name}: grupo quitado`);
    if (type === 'drivers') await refetchDrivers();
    else if (type === 'investors') await refetchInvestors();
    else await refetchDispatchers();
  };

  const counter = (list: Row[]) => {
    const active = list.filter(r => !r.inactive);
    return `${active.filter(r => r.groupId).length}/${active.length}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-header flex items-center gap-2">
            <MessageCircle className="h-6 w-6 text-green-600" /> WhatsApp
          </h1>
          <p className="page-description">Grupos, avisos automáticos y conexión del número</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={loadGroups} disabled={loadingGroups}>
          <RefreshCw className={`h-4 w-4 ${loadingGroups ? 'animate-spin' : ''}`} /> Recargar grupos
        </Button>
      </div>

      {/* Conexión */}
      <div className={`glass-card p-4 flex flex-col sm:flex-row sm:items-center gap-3 border-l-4 ${
        !connection ? 'border-l-muted' : connection.connected ? 'border-l-green-600' : 'border-l-destructive'
      }`}>
        <Smartphone className="h-8 w-8 text-muted-foreground flex-shrink-0" />
        <div className="flex-1 min-w-0">
          {!connection ? (
            <p className="text-sm text-muted-foreground">Verificando conexión...</p>
          ) : connection.connected ? (
            <>
              <p className="text-sm font-semibold text-green-700">Número conectado</p>
              <p className="text-xs text-muted-foreground">
                {connection.phone ? `+${String(connection.phone).replace(/^\+/, '')} · ` : ''}
                {groups ? `${groups.length} grupos disponibles` : 'Cargando grupos...'}
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-destructive">Número desconectado — no se están enviando avisos</p>
              <p className="text-xs text-muted-foreground">
                Estado: {connection.status}. Entra a whapi.cloud y vuelve a escanear el QR con el teléfono del número dedicado.
              </p>
            </>
          )}
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={checkConnection} disabled={checking}>
          {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Verificar
        </Button>
      </div>

      <Tabs defaultValue="groups">
        <TabsList>
          <TabsTrigger value="groups">Grupos</TabsTrigger>
          <TabsTrigger value="automations">Avisos</TabsTrigger>
          <TabsTrigger value="history">Historial</TabsTrigger>
        </TabsList>

        <TabsContent value="groups" className="mt-4">
          <div className="glass-card p-4">
            <Tabs defaultValue="drivers">
              <TabsList>
                <TabsTrigger value="drivers">Drivers ({counter(rows.drivers)})</TabsTrigger>
                <TabsTrigger value="investors">Investors ({counter(rows.investors)})</TabsTrigger>
                <TabsTrigger value="dispatchers">Dispatchers ({counter(rows.dispatchers)})</TabsTrigger>
              </TabsList>
              {(['drivers', 'investors', 'dispatchers'] as EntityType[]).map(type => (
                <TabsContent key={type} value={type} className="mt-3">
                  <GroupsTable rows={rows[type]} groups={groups} onAssign={(row, id, name) => assign(type, row, id, name)} />
                </TabsContent>
              ))}
            </Tabs>
          </div>
        </TabsContent>

        <TabsContent value="automations" className="mt-4">
          <div className="glass-card p-4 max-w-4xl">
            <p className="text-sm text-muted-foreground mb-3">
              Prende o apaga cada aviso y edita sus mensajes. Haz clic en un aviso para ver sus textos; las variables entre llaves se reemplazan con los datos reales.
            </p>
            <AutomationsPanel groups={groups} />
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <div className="glass-card p-4">
            <MessageHistory />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
