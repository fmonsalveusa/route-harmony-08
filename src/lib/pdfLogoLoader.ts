import logoUrl from '@/assets/dispatch-up-logo-pdf.png';

let cachedLogo: string | null = null;

export async function loadPdfLogo(): Promise<string> {
  if (cachedLogo) return cachedLogo;
  const res = await fetch(logoUrl);
  const blob = await res.blob();
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      cachedLogo = reader.result as string;
      resolve(cachedLogo);
    };
    reader.readAsDataURL(blob);
  });
}
