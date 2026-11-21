import { Capacitor } from '@capacitor/core';

/** Abre una URL externa. En la app instalada (Capacitor) window.open / target="_blank" no hacen nada. */
export async function openUrl(url: string) {
  if (Capacitor.isNativePlatform()) {
    const { Browser } = await import('@capacitor/browser');
    await Browser.open({ url });
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

export const mapsDirectionsUrl = (address: string) =>
  `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
