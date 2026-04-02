import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.dispatchup.driver2',
  appName: 'Dispatch Up',
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
    },
    Camera: {
      presentationStyle: 'fullscreen',
    },
  },
};

export default config;
