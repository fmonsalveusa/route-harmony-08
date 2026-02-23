import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.dispatchup.driver',
  appName: 'Dispatch Up Driver',
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
