import type { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: 'com.dispatchup.driver2',
  appName: 'Dispatch Up Driver',
  webDir: 'dist',
  android: {
    useLegacyBridge: true,
  },
  server: {
    url: 'https://www.dispatch-up.com',
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