const PUBLISHED_APP_URL = "https://www.dispatch-up.com";

export function getSigningBaseUrl() {
  if (typeof window === "undefined") return PUBLISHED_APP_URL;
  const { origin, hostname } = window.location;
  const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
  if (isLocalhost) return origin;
  return PUBLISHED_APP_URL;
}

export function getSigningUrl(documentId: string) {
  return `${getSigningBaseUrl()}/sign/${documentId}`;
}

// URL para compartir una plantilla — el destinatario la llena y firma
export function getTemplateSigningUrl(templateId: string) {
  return `${getSigningBaseUrl()}/sign/template/${templateId}`;
}
