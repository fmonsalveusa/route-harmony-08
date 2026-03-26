const PUBLISHED_APP_URL = "https://www.dispatch-up.com";

export function getSigningBaseUrl() {
  if (typeof window === "undefined") return PUBLISHED_APP_URL;
  const { origin, hostname } = window.location;
  const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
  const isLovablePreview = hostname.includes("id-preview--") || hostname.endsWith(".lovableproject.com");
  if (isLocalhost || isLovablePreview) return origin;
  return origin;
}

export function getSigningUrl(documentId: string) {
  return `${getSigningBaseUrl()}/sign/${documentId}`;
}
