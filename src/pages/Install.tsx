import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Smartphone, Download, Share, Plus } from 'lucide-react';
import logoImg from '@/assets/logo.png';

export default function Install() {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center space-y-3">
          <img src={logoImg} alt="Load Up" className="h-16 w-16 mx-auto rounded-xl shadow-md" />
          <h1 className="text-2xl font-bold">Install Load Up Driver</h1>
          <p className="text-sm text-muted-foreground">Install the app on your phone for the best experience</p>
        </div>

        {isIOS ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Smartphone className="h-5 w-5" /> iPhone / iPad</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">1</div>
                <p className="text-sm">Tap the <Share className="inline h-4 w-4" /> <strong>Share</strong> button in Safari</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">2</div>
                <p className="text-sm">Scroll down and tap <strong>"Add to Home Screen"</strong></p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">3</div>
                <p className="text-sm">Tap <strong>"Add"</strong> to install</p>
              </div>
            </CardContent>
          </Card>
        ) : isAndroid ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Smartphone className="h-5 w-5" /> Android</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">1</div>
                <p className="text-sm">Tap the <strong>⋮ menu</strong> (three dots) in Chrome</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">2</div>
                <p className="text-sm">Tap <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong></p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">3</div>
                <p className="text-sm">Tap <strong>"Install"</strong> to confirm</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Installation Instructions</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Open this page on your phone's browser (Chrome for Android or Safari for iPhone) and follow the prompts to install.</p>
            </CardContent>
          </Card>
        )}

        <p className="text-center text-xs text-muted-foreground">After installing, open the app from your home screen and log in with your credentials.</p>
      </div>
    </div>
  );
}
