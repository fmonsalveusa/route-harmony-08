import { useState, useEffect } from 'react';
import type { DbTruck } from '@/hooks/useTrucks';
import { ExternalLink, FileText, Wrench, Loader2, Download, Eye, ImageIcon } from 'lucide-react';
import { formatDate } from '@/lib/dateUtils';
import { ExpiryBadge } from '@/components/ExpiryBadge';
import { useTruckMaintenance } from '@/hooks/useTruckMaintenance';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { getStatusColor } from '@/components/maintenance/maintenanceConstants';

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <div className="font-medium text-sm mt-0.5">{children}</div>
    </div>
  );
}

const DOC_LABELS: { key: keyof DbTruck; label: string }[] = [
  { key: 'registration_photo_url', label: 'Registration' },
  { key: 'insurance_photo_url', label: 'Insurance' },
  { key: 'license_photo_url', label: 'License' },
  { key: 'rear_truck_photo_url', label: 'Rear Photo' },
  { key: 'truck_side_photo_url', label: 'Side Photo' },
  { key: 'truck_plate_photo_url', label: 'Plate Photo' },
  { key: 'cargo_area_photo_url', label: 'Cargo Area' },
];

interface Props {
  truck: DbTruck;
  driverName: string | null;
  getDocSignedUrl?: (storedUrl: string) => Promise<string | null>;
}

export function TruckDetailPanel({ truck, driverName, getDocSignedUrl }: Props) {
  const { maintenanceItems } = useTruckMaintenance();
  const truckMaint = maintenanceItems.filter(m => m.truck_id === truck.id);
  const [loadingDoc, setLoadingDoc] = useState<string | null>(null);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLabel, setPreviewLabel] = useState('');

  // Pre-load signed URLs for thumbnails
  useEffect(() => {
    if (!getDocSignedUrl) return;
    const docsWithUrl = DOC_LABELS.filter(d => truck[d.key]);
    docsWithUrl.forEach(async (doc) => {
      const raw = truck[doc.key] as string;
      try {
        const signed = await getDocSignedUrl(raw);
        if (signed) {
          setSignedUrls(prev => ({ ...prev, [doc.key]: signed }));
        }
      } catch {
        // fallback: use raw url
      }
    });
  }, [truck, getDocSignedUrl]);

  const handleViewDoc = async (url: string, key: string) => {
    const newWindow = window.open('about:blank', '_blank');
    if (!getDocSignedUrl) {
      if (newWindow) newWindow.location.href = url;
      return;
    }
    setLoadingDoc(key);
    try {
      const signedUrl = await getDocSignedUrl(url);
      if (newWindow) newWindow.location.href = signedUrl || url;
    } catch {
      if (newWindow) newWindow.location.href = url;
    } finally {
      setLoadingDoc(null);
    }
  };

  const handleDownloadDoc = async (url: string, key: string, label: string) => {
    setLoadingDoc(key + '_dl');
    try {
      const finalUrl = getDocSignedUrl ? (await getDocSignedUrl(url)) || url : url;
      const a = document.createElement('a');
      a.href = finalUrl;
      a.download = `${truck.unit_number}_${label.replace(/\s/g, '_')}`;
      a.target = '_blank';
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      window.open(url, '_blank');
    } finally {
      setLoadingDoc(null);
    }
  };

  const openPreview = (key: string, label: string) => {
    const url = signedUrls[key] || (truck[key as keyof DbTruck] as string);
    if (url) {
      setPreviewUrl(url);
      setPreviewLabel(label);
    }
  };

  const docsWithUrl = DOC_LABELS.filter(d => truck[d.key]);
  const docsWithoutUrl = DOC_LABELS.filter(d => !truck[d.key]);

  return (
    <>
      <div className="p-5 bg-muted/20 border-t space-y-4 animate-fade-in">
        {/* Document Expiry Alerts */}
        {(truck.registration_expiry || truck.insurance_expiry) && (
          <div className="flex flex-wrap gap-2">
            <ExpiryBadge date={truck.registration_expiry} label="Registration" />
            <ExpiryBadge date={truck.insurance_expiry} label="Insurance" />
          </div>
        )}

        {/* General Info */}
        <section>
          <h3 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">General Information</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-x-6 gap-y-3">
            <Info label="Unit #">{truck.unit_number}</Info>
            <Info label="Type">{truck.truck_type}</Info>
            <Info label="Make">{truck.make || '—'}</Info>
            <Info label="Model">{truck.model || '—'}</Info>
            <Info label="Year">{truck.year ?? '—'}</Info>
            <Info label="VIN">{truck.vin || '—'}</Info>
            <Info label="License Plate">{truck.license_plate || '—'}</Info>
            <Info label="Max Payload">{truck.max_payload_lbs ? `${truck.max_payload_lbs.toLocaleString()} lbs` : '—'}</Info>
            <Info label="Driver">{driverName || 'Unassigned'}</Info>
            <Info label="Insurance Expiry">{formatDate(truck.insurance_expiry)}</Info>
            <Info label="Registration Expiry">{formatDate(truck.registration_expiry)}</Info>
            <Info label="Status"><Badge variant="outline" className="capitalize">{truck.status}</Badge></Info>
          </div>
        </section>

        {/* Box Truck dimensions */}
        {truck.truck_type === 'Box Truck' && (
          <section className="border-t pt-3">
            <h3 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Box Truck Dimensions</h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-x-6 gap-y-3">
              <Info label="Cargo Length (ft)">{truck.cargo_length_ft ?? '—'}</Info>
              <Info label="Cargo Width (in)">{truck.cargo_width_in ?? '—'}</Info>
              <Info label="Cargo Height (in)">{truck.cargo_height_in ?? '—'}</Info>
              <Info label="Door Width (in)">{truck.rear_door_width_in ?? '—'}</Info>
              <Info label="Door Height (in)">{truck.rear_door_height_in ?? '—'}</Info>
            </div>
          </section>
        )}

        {/* Hotshot dimensions */}
        {truck.truck_type === 'Hotshot' && (
          <section className="border-t pt-3">
            <h3 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Hotshot Dimensions</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
              <Info label="Trailer Length (ft)">{truck.trailer_length_ft ?? '—'}</Info>
              <Info label="Mega Ramp">{truck.mega_ramp || '—'}</Info>
            </div>
          </section>
        )}

        {/* Maintenance Summary */}
        {truckMaint.length > 0 && (
          <section className="border-t pt-3">
            <h3 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider flex items-center gap-1">
              <Wrench className="h-3.5 w-3.5" /> Maintenance
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {truckMaint.map(m => {
                const colors = getStatusColor(m.status);
                const pct = m.interval_miles && m.interval_miles > 0
                  ? Math.min((m.miles_accumulated / m.interval_miles) * 100, 100) : null;
                return (
                  <div key={m.id} className={`flex items-center gap-2 px-3 py-2 rounded-md border text-xs ${colors.border} ${colors.bg}`}>
                    <div className={`w-2 h-2 rounded-full ${colors.dot}`} />
                    <span className="font-medium flex-1">{m.maintenance_type}</span>
                    {pct !== null && (
                      <div className="w-16">
                        <Progress value={pct} className="h-1.5" />
                      </div>
                    )}
                    <Badge variant="outline" className={`${colors.text} text-[9px] px-1`}>{m.status.toUpperCase()}</Badge>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Documents & Photos with Thumbnails */}
        <section className="border-t pt-3">
          <h3 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider flex items-center gap-1">
            <ImageIcon className="h-3.5 w-3.5" /> Documents & Photos
          </h3>

          {docsWithUrl.length === 0 ? (
            <p className="text-muted-foreground text-sm italic">No documents or photos uploaded.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {docsWithUrl.map(doc => {
                const rawUrl = truck[doc.key] as string;
                const thumbUrl = signedUrls[doc.key] || rawUrl;
                const isImage = /\.(jpg|jpeg|png|webp|gif|bmp|svg)(\?|$)/i.test(rawUrl) || rawUrl.includes('/driver-documents/');

                return (
                  <div key={doc.key} className="group border rounded-lg overflow-hidden bg-background shadow-sm hover:shadow-md transition-shadow">
                    {/* Thumbnail */}
                    <div
                      className="h-32 bg-muted flex items-center justify-center cursor-pointer relative overflow-hidden"
                      onClick={() => openPreview(doc.key, doc.label)}
                    >
                      {isImage && thumbUrl ? (
                        <img
                          src={thumbUrl}
                          alt={doc.label}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                            (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                          }}
                        />
                      ) : null}
                      <div className={`flex flex-col items-center gap-1 text-muted-foreground ${isImage && thumbUrl ? 'hidden' : ''}`}>
                        <FileText className="h-8 w-8" />
                        <span className="text-[10px]">Click to preview</span>
                      </div>
                      {/* Hover overlay */}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Eye className="h-6 w-6 text-white" />
                      </div>
                    </div>
                    {/* Label & Actions */}
                    <div className="p-2 flex items-center justify-between gap-1">
                      <span className="text-xs font-medium truncate">{doc.label}</span>
                      <div className="flex items-center gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          disabled={loadingDoc === doc.key}
                          onClick={(e) => { e.stopPropagation(); handleViewDoc(rawUrl, doc.key); }}
                          title="Open in new tab"
                        >
                          {loadingDoc === doc.key ? <Loader2 className="h-3 w-3 animate-spin" /> : <ExternalLink className="h-3 w-3" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          disabled={loadingDoc === doc.key + '_dl'}
                          onClick={(e) => { e.stopPropagation(); handleDownloadDoc(rawUrl, doc.key, doc.label); }}
                          title="Download"
                        >
                          {loadingDoc === doc.key + '_dl' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Missing documents list */}
          {docsWithoutUrl.length > 0 && docsWithUrl.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className="text-[10px] text-muted-foreground uppercase font-semibold mr-1">Missing:</span>
              {docsWithoutUrl.map(doc => (
                <Badge key={doc.key} variant="outline" className="text-[10px] text-muted-foreground">
                  {doc.label}
                </Badge>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Full-screen image preview dialog */}
      <Dialog open={!!previewUrl} onOpenChange={(v) => { if (!v) { setPreviewUrl(null); setPreviewLabel(''); } }}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-2">
          <div className="text-center">
            <p className="text-sm font-medium mb-2">{previewLabel} — Unit #{truck.unit_number}</p>
            {previewUrl && (
              <img
                src={previewUrl}
                alt={previewLabel}
                className="max-w-full max-h-[75vh] mx-auto rounded-md object-contain"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
