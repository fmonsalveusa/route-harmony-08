import { useEffect, useState } from 'react';

const ANDROID_BASE_PADDING = 84;
const DEFAULT_BASE_PADDING = 32;
const MAX_PADDING = 160;
const EXTRA_OFFSET = 20;

function isAndroidDevice() {
  return typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);
}

function calculateBottomPadding(): number {
  if (typeof window === 'undefined') return DEFAULT_BASE_PADDING;

  const viewport = window.visualViewport;
  const viewportInset = viewport
    ? Math.max(0, window.innerHeight - (viewport.height + viewport.offsetTop))
    : 0;

  const basePadding = isAndroidDevice() ? ANDROID_BASE_PADDING : DEFAULT_BASE_PADDING;
  return Math.min(MAX_PADDING, Math.max(basePadding, Math.round(viewportInset + EXTRA_OFFSET)));
}

export function useBottomSafePadding() {
  const [padding, setPadding] = useState<number>(() => calculateBottomPadding());

  useEffect(() => {
    const updatePadding = () => setPadding(calculateBottomPadding());

    updatePadding();
    window.addEventListener('resize', updatePadding);
    window.addEventListener('orientationchange', updatePadding);

    const viewport = window.visualViewport;
    viewport?.addEventListener('resize', updatePadding);
    viewport?.addEventListener('scroll', updatePadding);

    return () => {
      window.removeEventListener('resize', updatePadding);
      window.removeEventListener('orientationchange', updatePadding);
      viewport?.removeEventListener('resize', updatePadding);
      viewport?.removeEventListener('scroll', updatePadding);
    };
  }, []);

  return `${padding}px`;
}
