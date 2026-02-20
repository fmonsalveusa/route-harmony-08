import { useDriverTracking } from '@/contexts/DriverTrackingContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { MapPin, Navigation } from 'lucide-react';

export default function DriverTracking() {
  const { tracking, lastPosition, startTracking, stopTracking } = useDriverTracking();

  return (
    <div className="p-4 pb-[calc(72px+env(safe-area-inset-bottom,0px))] space-y-4">
      <h1 className="text-xl font-bold">GPS Tracking</h1>

      <Card>
        <CardContent className="p-6 flex flex-col items-center gap-4">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center ${tracking ? 'bg-success/20' : 'bg-muted'}`}>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${tracking ? 'bg-success animate-pulse' : 'bg-muted-foreground/20'}`}>
              <Navigation className={`h-6 w-6 ${tracking ? 'text-success-foreground' : 'text-muted-foreground'}`} />
            </div>
          </div>

          <p className="text-base font-medium">{tracking ? 'Tracking Active' : 'Tracking Off'}</p>

          <Button
            size="lg"
            className={`w-full gap-2 ${tracking ? 'bg-destructive hover:bg-destructive/90' : ''}`}
            onClick={tracking ? stopTracking : startTracking}
          >
            <MapPin className="h-6 w-6" />
            {tracking ? 'Stop Tracking' : 'Start Tracking'}
          </Button>
        </CardContent>
      </Card>

      {lastPosition && (
        <Card>
          <CardContent className="p-3">
            <p className="text-sm text-muted-foreground">Last known position</p>
            <p className="text-base font-mono">{lastPosition.lat.toFixed(6)}, {lastPosition.lng.toFixed(6)}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
