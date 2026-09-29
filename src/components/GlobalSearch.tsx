import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Command as CommandPrimitive } from 'cmdk';
import { Search, Package, Users, Truck, Building } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { useLoads } from '@/hooks/useLoads';
import { useDrivers } from '@/hooks/useDrivers';
import { useTrucks } from '@/hooks/useTrucks';
import { useAuth } from '@/contexts/AuthContext';
import { useDispatcherDriverIds } from '@/hooks/useDispatcherDriverIds';

const MAX_PER_GROUP = 6;

const norm = (s: string | null | undefined) => (s ?? '').toLowerCase();

/**
 * Buscador de toda la app (estilo RouteOne): cargas, drivers, unidades y brokers.
 * Se abre con el botón de la barra de arriba o con Ctrl+K / Cmd+K.
 */
export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const { loads } = useLoads();
  const { drivers } = useDrivers();
  const { trucks } = useTrucks();
  // Un dispatcher solo ve lo de sus drivers, igual que en las páginas
  const { driverIds: scopeIds } = useDispatcherDriverIds();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(o => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => { if (!open) setQuery(''); }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return null;
    // Por teléfono solo con 3 dígitos o más, para no traer a todos con un "1"
    const digits = q.replace(/\D/g, '');
    const phoneMatch = (phone: string | null | undefined) => digits.length >= 3 && norm(phone).replace(/\D/g, '').includes(digits);

    const scopedLoads = scopeIds ? loads.filter(l => l.driver_id && scopeIds.has(l.driver_id)) : loads;
    const scopedDrivers = scopeIds ? drivers.filter(d => scopeIds.has(d.id)) : drivers;

    const loadHits = hasPermission('loads')
      ? scopedLoads
          .filter(l => norm(l.reference_number).includes(q))
          // Primero los que empiezan con lo escrito
          .sort((a, b) => Number(!norm(a.reference_number).startsWith(q)) - Number(!norm(b.reference_number).startsWith(q)))
          .slice(0, MAX_PER_GROUP)
      : [];

    const driverHits = hasPermission('drivers')
      ? scopedDrivers
          .filter(d => norm(d.name).includes(q) || phoneMatch(d.phone) || norm(d.email).includes(q))
          .sort((a, b) => Number(a.status === 'inactive') - Number(b.status === 'inactive'))
          .slice(0, MAX_PER_GROUP)
      : [];

    const truckHits = hasPermission('fleet')
      ? trucks
          .filter(t => norm(t.unit_number).includes(q) || norm(t.vin).includes(q) || norm(t.license_plate).includes(q))
          .slice(0, MAX_PER_GROUP)
      : [];

    const brokerHits = hasPermission('loads')
      ? [...new Set(scopedLoads.map(l => l.broker_client).filter((b): b is string => !!b && norm(b).includes(q)))]
          .sort()
          .slice(0, MAX_PER_GROUP)
      : [];

    return { loadHits, driverHits, truckHits, brokerHits };
  }, [query, loads, drivers, trucks, scopeIds, hasPermission]);

  const go = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  const driverName = (id: string | null) => drivers.find(d => d.id === id)?.name;
  const truckDriver = (truckId: string) => drivers.find(d => String(d.truck_id) === String(truckId))?.name;
  const empty = results && !results.loadHits.length && !results.driverHits.length && !results.truckHits.length && !results.brokerHits.length;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden md:flex items-center gap-2 h-8 w-64 lg:w-80 rounded-full bg-white/15 hover:bg-white/25 px-3 text-xs text-white/80 transition-colors"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="flex-1 text-left">Buscar carga, driver, unidad...</span>
        <kbd className="rounded border border-white/30 px-1.5 py-0.5 text-[10px] font-mono">Ctrl K</kbd>
      </button>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="md:hidden p-1.5 rounded-md hover:bg-white/10 text-white"
        aria-label="Buscar"
      >
        <Search className="h-5 w-5" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="overflow-hidden p-0 shadow-lg max-w-xl top-[20%] translate-y-0">
          <DialogTitle className="sr-only">Buscar</DialogTitle>
          {/* El filtro lo hacemos nosotros: son miles de cargas y solo se muestran las primeras de cada grupo */}
          <CommandPrimitive shouldFilter={false} className="flex h-full w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground">
            <div className="flex items-center border-b px-3" cmdk-input-wrapper="">
              <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
              <CommandPrimitive.Input
                value={query}
                onValueChange={setQuery}
                placeholder="Número de carga, driver, teléfono, unidad, VIN, broker..."
                className="flex h-12 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <CommandList className="max-h-[420px]">
              {!results && (
                <p className="py-6 text-center text-sm text-muted-foreground">Escribe al menos 2 letras o números.</p>
              )}
              {empty && <CommandEmpty>Sin resultados para "{query}".</CommandEmpty>}

              {results && results.loadHits.length > 0 && (
                <CommandGroup heading="Cargas">
                  {results.loadHits.map(l => (
                    <CommandItem key={l.id} value={`load-${l.id}`} onSelect={() => go(`/loads?openLoad=${l.id}`)} className="gap-3">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">#{l.reference_number}</p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {[driverName(l.driver_id), l.broker_client, l.pickup_date].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      <span className="text-[10px] uppercase text-muted-foreground">{l.status.replace(/_/g, ' ')}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {results && results.driverHits.length > 0 && (
                <CommandGroup heading="Drivers">
                  {results.driverHits.map(d => (
                    <CommandItem key={d.id} value={`driver-${d.id}`} onSelect={() => go(`/drivers?openDriver=${d.id}`)} className="gap-3">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{d.name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{[d.phone, d.email].filter(Boolean).join(' · ')}</p>
                      </div>
                      {d.status === 'inactive' && <span className="text-[10px] uppercase text-muted-foreground">inactive</span>}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {results && results.truckHits.length > 0 && (
                <CommandGroup heading="Unidades">
                  {results.truckHits.map(t => (
                    <CommandItem key={t.id} value={`truck-${t.id}`} onSelect={() => go(`/fleet?openTruck=${t.id}`)} className="gap-3">
                      <Truck className="h-4 w-4 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">Unit #{t.unit_number}</p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {[truckDriver(t.id), [t.make, t.model].filter(Boolean).join(' '), t.license_plate].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {results && results.brokerHits.length > 0 && (
                <CommandGroup heading="Brokers">
                  {results.brokerHits.map(b => (
                    <CommandItem key={b} value={`broker-${b}`} onSelect={() => go(`/loads?q=${encodeURIComponent(b)}`)} className="gap-3">
                      <Building className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm truncate">{b}</p>
                      <span className="ml-auto text-[10px] text-muted-foreground">ver sus cargas</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </CommandPrimitive>
        </DialogContent>
      </Dialog>
    </>
  );
}
