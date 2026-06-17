import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Camera, X, Loader2 } from 'lucide-react';
import { PAYMENT_METHODS } from '@/components/expenses/expenseConstants';
import { supabase } from '@/integrations/supabase/client';
import { MAPBOX_TOKEN, mapboxGeocode } from '@/lib/mapConfig';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  maintenanceType: string;
  onSubmit: (data: {
    last_performed_at: string;
    last_miles: number;
    service_location?: string | null;
    service_lat?: number | null;
    service_lng?: number | null;
    cost?: number | null;
    tax_amount?: number | null;
    vendor?: string | null;
    payment_method?: string;
    location?: string | null;
    invoice_number?: string | null;
    invoice_photo_url?: string | null;
    create_expense?: boolean;
  }) => Promise<boolean>;
}

export function LogServiceDialog({ open, onOpenChange, maintenanceType, onSubmit }: Props) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [miles, setMiles] = useState('');
  const [serviceLocation, setServiceLocation] = useState('');
  const [serviceLat, setServiceLat] = useState<number | null>(null);
  const [serviceLng, setServiceLng] = useState<number | null>(null);
  const [locationSuggestions, setLocationSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const locationDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [cost, setCost] = useState('');
  const [taxAmount, setTaxAmount] = useState('');
  const [vendor, setVendor] = useState('');
  const [location, setLocation] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('other');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [createExpense, setCreateExpense] = useState(true);
  const [saving, setSaving] = useState(false);
  const [invoicePhotoUrl, setInvoicePhotoUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const searchLocation = async (query: string) => {
    if (!query || query.length < 3) { setLocationSuggestions([]); return; }
    setLoadingSuggestions(true);
    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&country=us&types=place,address&limit=5`
      );
      const data = await res.json();
      setLocationSuggestions(data.features || []);
      setShowSuggestions(true);
    } catch { setLocationSuggestions([]); }
    finally { setLoadingSuggestions(false); }
  };

  const handleLocationInput = (val: string) => {
    setServiceLocation(val);
    setServiceLat(null);
    setServiceLng(null);
    if (locationDebounce.current) clearTimeout(locationDebounce.current);
    locationDebounce.current = setTimeout(() => searchLocation(val), 350);
  };

  const selectLocation = (feature: any) => {
    setServiceLocation(feature.place_name);
    setServiceLat(feature.center[1]);
    setServiceLng(feature.center[0]);
    setLocationSuggestions([]);
    setShowSuggestions(false);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `maintenance/invoices/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from('driver-documents').upload(path, file);
      if (error) throw error;
      const { data } = await supabase.storage.from('driver-documents').createSignedUrl(path, 31536000);
      setInvoicePhotoUrl(data?.signedUrl || null);
    } catch (e: any) {
      console.error('Error uploading photo:', e);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const totalAmount = (parseFloat(cost) || 0) + (parseFloat(taxAmount) || 0);

  const handleSubmit = async () => {
    setSaving(true);

    // Si hay texto pero no coordenadas, geocodificar antes de guardar
    let finalLat = serviceLat;
    let finalLng = serviceLng;
    if (serviceLocation && (!finalLat || !finalLng)) {
      try {
        const coords = await mapboxGeocode(serviceLocation);
        if (coords) {
          finalLng = coords[0];
          finalLat = coords[1];
          console.log(`[LogServiceDialog] Geocoded "${serviceLocation}" → ${finalLat}, ${finalLng}`);
        }
      } catch (e) {
        console.warn('[LogServiceDialog] Geocoding fallback failed:', e);
      }
    }

    const ok = await onSubmit({
      last_performed_at: date,
      last_miles: Number(miles) || 0,
      service_location: serviceLocation || null,
      service_lat: finalLat,
      service_lng: finalLng,
      cost: cost ? Number(cost) : null,
      tax_amount: taxAmount ? Number(taxAmount) : null,
      vendor: vendor || null,
      payment_method: paymentMethod,
      location: location || null,
      invoice_number: invoiceNumber || null,
      invoice_photo_url: invoicePhotoUrl || null,
      create_expense: createExpense,
    });
    setSaving(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Log Service — {maintenanceType}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Information */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Basic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Date Performed</Label>
                <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
              </div>
              <div>
                <Label>Current Odometer (miles)</Label>
                <Input type="number" value={miles} onChange={e => setMiles(e.target.value)} placeholder="160000" />
              </div>
              <div className="md:col-span-2 relative">
                <Label>Service Location <span className="text-muted-foreground font-normal">(ciudad donde se realizó el servicio)</span></Label>
                <Input
                  value={serviceLocation}
                  onChange={e => handleLocationInput(e.target.value)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  placeholder="Ej: Atlanta, GA"
                  autoComplete="off"
                />
                {loadingSuggestions && <div className="absolute right-3 top-9 text-xs text-muted-foreground">Buscando...</div>}
                {showSuggestions && locationSuggestions.length > 0 && (
                  <div className="absolute z-50 w-full bg-popover border rounded-md shadow-md mt-1 max-h-48 overflow-y-auto">
                    {locationSuggestions.map((f: any) => (
                      <div
                        key={f.id}
                        className="px-3 py-2 text-sm cursor-pointer hover:bg-muted"
                        onMouseDown={() => selectLocation(f)}
                      >
                        {f.place_name}
                      </div>
                    ))}
                  </div>
                )}
                {serviceLat && serviceLng && (
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    ✓ Coordenadas: {serviceLat.toFixed(4)}, {serviceLng.toFixed(4)}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Cost Information */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Cost Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Amount</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input type="number" step="0.01" min="0" className="pl-7" value={cost}
                    onChange={e => setCost(e.target.value)} placeholder="0.00" />
                </div>
              </div>
              <div>
                <Label>Tax Amount</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input type="number" step="0.01" min="0" className="pl-7" value={taxAmount}
                    onChange={e => setTaxAmount(e.target.value)} placeholder="0.00" />
                </div>
              </div>
              <div>
                <Label>Total Amount</Label>
                <div className="h-10 flex items-center px-3 bg-muted rounded-md text-lg font-bold">
                  ${totalAmount.toFixed(2)}
                </div>
              </div>
              <div>
                <Label>Payment Method</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map(p => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Vendor</Label>
                <Input value={vendor} maxLength={100} onChange={e => setVendor(e.target.value)} placeholder="e.g. Shop name" />
              </div>
              <div>
                <Label>Location</Label>
                <Input value={location} maxLength={100} onChange={e => setLocation(e.target.value)} placeholder="City, State" />
              </div>
            </div>
          </div>

          {/* Additional Information */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Additional Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Invoice/Receipt Number</Label>
                <Input value={invoiceNumber} maxLength={50} onChange={e => setInvoiceNumber(e.target.value)} placeholder="e.g., INV-12345" />
              </div>
              <div className="md:col-span-2">
                <Label>Invoice Photo</Label>
                <div className="mt-1">
                  {invoicePhotoUrl ? (
                    <div className="flex items-center gap-3">
                      <a href={invoicePhotoUrl} target="_blank" rel="noopener noreferrer">
                        <img src={invoicePhotoUrl} alt="Invoice" className="h-20 w-auto rounded border object-cover cursor-pointer hover:opacity-80" />
                      </a>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setInvoicePhotoUrl(null)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button variant="outline" className="gap-2" onClick={() => photoInputRef.current?.click()} disabled={uploadingPhoto}>
                      {uploadingPhoto ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                      {uploadingPhoto ? 'Uploading...' : 'Upload Invoice Photo'}
                    </Button>
                  )}
                  <input ref={photoInputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handlePhotoUpload} />
                </div>
              </div>
              {Number(cost) > 0 && (
                <div className="flex items-center gap-2 self-end pb-2">
                  <Switch checked={createExpense} onCheckedChange={setCreateExpense} />
                  <Label className="cursor-pointer text-sm">Create expense record</Label>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving...' : 'Log Service'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
