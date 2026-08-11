declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

export function pushDataLayerEvent(
  event: string,
  params?: Record<string, unknown>
) {
  if (typeof window === "undefined" || !window.dataLayer) return;
  window.dataLayer.push({ event, ...params });
}
