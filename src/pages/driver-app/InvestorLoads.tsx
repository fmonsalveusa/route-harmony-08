import { useState } from 'react';
import { useLoads } from '@/hooks/useLoads';
import { useAuth } from '@/contexts/AuthContext';
import { useDriverPayments } from '@/hooks/useDriverPayments';
import { supabase } from '@/integrations/supabase/client';
import { PullToRefresh } from '@/components/driver-app/PullToRefresh';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, ChevronDown, ChevronUp, FileText, ExternalLink, DollarSign } from 'lucide-react';
import { formatDate } from '@/lib/dateUtils';

// Extrae ciudad y estado de una dirección
function cityState(addr: string) {
  if (!addr) return '—';
  const parts = addr.split(',').map(s => s.trim());
  return parts.slice(-2, -1)[0] || parts[0] || addr;
}

const STATUS_COLORS: Record<string, string> = {
  planned:          'border-l-[#94A3B8]',
  dispatched:       'border-l-[#2563EB]',
  in_transit:       'border-l-[#65A30D]',
  on_site_pickup:   'border-l-[#06B6D4]',
  picked_up:        'border-l-[#D946EF]',
  on_site_delivery: 'border-l-[#F97316]',
  delivered:        'border-l-[#178504]',
  tonu:             'border-l-[#B45309]',
  cancelled:        'border-l-[#DC2626]',
};

const STATUS_LABELS: Record<string, string> = {
  planned: 'Planned', dispatched: 'Dispatched', in_transit: 'In Transit',
  on_site_pickup: 'On Site - Pickup', picked_up: 'Picked Up',
  on_site_delivery: 'On Site - Delivery', delivered: 'Delivered',
  tonu: 'TONU', cancelled: 'Canceled',
};

const STATUS_BADGE: Record<string, string> = {
  planned:          'bg-slate-400 text-white',
  dispatched:       'bg-blue-600 text-white',
  in_transit:       'bg-lime-600 text-white',
  on_site_pickup:   'bg-cyan-500 text-white',
  picked_up:        'bg-fuchsia-500 text-white',
  on_site_delivery: 'bg-orange-500 text-white',
  delivered:        'bg-green-700 text-white',
  tonu:             'bg-amber-700 text-white',
  cancelled:        'bg-red-600 text-white',
};

export default function InvestorLoads() {
  const { loads, loading, fetchLoads } = useLoads();
  const { investorPayments } = useDriverPayments();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loadingPdf, setLoadingPdf] = useState<string | null>(null);

  // Solo cargas que tienen pago del investor
  const investorLoadIds = new Set(investorPayments.map(p => p.load_id));
  const myLoads = loads
    .filter(l => investorLoadIds.has(l.id))
    .sort((a, b) => {
      // Más recientes primero
      const da = a.pickup_date || a.created_at;
      const db = b.pickup_date || b.created_at;
      return db.localeCompare(da);
    });

  const openPdf = async (url: string, loadId: string) => {
    if (!url) return;
    setLoadingPdf(loadId);
    try {
      // Si es una ruta de storage, generar URL firmada
      if (!url.startsWith('http')) {
        const { data } = await supabase.storage
          .from('driver-documents')
          .createSignedUrl(url, 3600);
        if (data?.signedUrl) {
          window.open(data.signedUrl, '_blank', 'noopener');
          return;
        }
      }
      window.open(url, '_blank', 'noopener');
    } catch (e) {
      console.error('Error opening PDF:', e);
    } finally {
      setLoadingPdf(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <PullToRefresh onRefresh={fetchLoads}>
      <div className="p-4 space-y-3 pb-[calc(80px+env(safe-area-inset-bottom,0px))]">
        <div>
          <h1 className="text-xl font-bold">My Loads</h1>
          <p className="text-sm text-muted-foreground">{myLoads.length} load{myLoads.length !== 1 ? 's' : ''} linked to your investment</p>
        </div>

        {myLoads.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-muted-foreground">No loads yet.</CardContent></Card>
        ) : (
          myLoads.map(load => {
            const isExpanded = expandedId === load.id;
            const borderColor = STATUS_COLORS[load.status] || 'border-l-slate-300';
            const payment = investorPayments.find(p => p.load_id === load.id);

            return (
              <Card
                key={load.id}
                className={`border-l-[3px] ${borderColor} cursor-pointer overflow-hidden`}
                onClick={() => setExpandedId(isExpanded ? null : load.id)}
              >
                <CardContent className="p-3">
                  {/* Top row */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-base">#{load.reference_number}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_BADGE[load.status] || 'bg-muted text-muted-foreground'}`}>
                          {STATUS_LABELS[load.status] || load.status}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{load.broker_client || '—'}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-base font-bold text-green-600">${Number(load.total_rate).toLocaleString()}</div>
                      {payment && (
                        <div className="text-xs text-muted-foreground">
                          My cut: <span className="font-semibold text-violet-600">${Number(payment.amount).toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Route */}
                  <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3 text-green-600 flex-shrink-0" />
                    <span className="truncate">{cityState(load.origin)}</span>
                    <span>→</span>
                    <MapPin className="h-3 w-3 text-red-500 flex-shrink-0" />
                    <span className="truncate">{cityState(load.destination)}</span>
                  </div>

                  {/* Dates */}
                  <div className="flex gap-4 mt-1.5 text-xs text-muted-foreground">
                    <span>Pickup: {formatDate(load.pickup_date)}</span>
                    <span>Delivery: {formatDate(load.delivery_date)}</span>
                  </div>

                  {/* Chevron */}
                  <div className="flex justify-center mt-1">
                    {isExpanded
                      ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t space-y-3" onClick={e => e.stopPropagation()}>
                      {/* Stats */}
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-muted/40 rounded-lg p-2">
                          <div className="text-[10px] text-muted-foreground">Miles</div>
                          <div className="text-sm font-bold">{Number(load.miles || 0).toLocaleString()}</div>
                        </div>
                        <div className="bg-muted/40 rounded-lg p-2">
                          <div className="text-[10px] text-muted-foreground">Empty Mi</div>
                          <div className="text-sm font-bold">{Number(load.empty_miles || 0).toLocaleString()}</div>
                        </div>
                        <div className="bg-muted/40 rounded-lg p-2">
                          <div className="text-[10px] text-muted-foreground">RPM</div>
                          <div className="text-sm font-bold">
                            {load.miles && Number(load.miles) > 0
                              ? `$${(Number(load.total_rate) / Number(load.miles)).toFixed(2)}`
                              : '—'}
                          </div>
                        </div>
                      </div>

                      {/* Payment status */}
                      {payment && (
                        <div className="flex items-center justify-between p-2 rounded-lg bg-violet-50 border border-violet-200">
                          <div className="flex items-center gap-2">
                            <DollarSign className="h-4 w-4 text-violet-600" />
                            <span className="text-sm font-medium text-violet-700">My Payment</span>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-bold text-violet-700">${Number(payment.amount).toLocaleString()}</div>
                            <div className={`text-[10px] font-semibold ${payment.status === 'paid' ? 'text-green-600' : 'text-amber-600'}`}>
                              {payment.status === 'paid' ? 'PAID' : 'PENDING'}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* RC PDF — solo lectura */}
                      {load.pdf_url && (
                        <button
                          className="w-full flex items-center justify-between p-2.5 rounded-lg border border-green-200 bg-green-50 text-green-700"
                          onClick={() => openPdf(load.pdf_url!, load.id)}
                          disabled={loadingPdf === load.id}
                        >
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            <span className="text-sm font-medium">Rate Confirmation</span>
                          </div>
                          {loadingPdf === load.id
                            ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-green-600 border-t-transparent" />
                            : <ExternalLink className="h-4 w-4" />}
                        </button>
                      )}

                      {/* Full addresses */}
                      <div className="space-y-1.5 text-xs text-muted-foreground">
                        <div className="flex gap-1.5">
                          <MapPin className="h-3 w-3 text-green-600 flex-shrink-0 mt-0.5" />
                          <span>{load.origin}</span>
                        </div>
                        <div className="flex gap-1.5">
                          <MapPin className="h-3 w-3 text-red-500 flex-shrink-0 mt-0.5" />
                          <span>{load.destination}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </PullToRefresh>
  );
}
