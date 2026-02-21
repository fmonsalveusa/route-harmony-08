import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.091db5142f774b42adb88401c76bdec5',
  appName: 'route-harmony-08',
  webDir: 'dist',
  server: {
    url: 'https://091db514-2f77-4b42-adb8-8401c76bdec5.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      androidScaleType: 'CENTER_CROP',
    },
    Camera: {
      presentationStyle: 'fullscreen',
    },
  },
};

export default config;
