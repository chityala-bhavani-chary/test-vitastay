/**
 * BIC-024 — map provider keys. No key → list-only fallback (never geocode).
 */
export const googleMapsKey = () => String(import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();
export const mapplsKey = () => String(import.meta.env.VITE_MAPPLS_KEY || '').trim();

export const mapProvider = () => {
  if (googleMapsKey()) return 'google';
  if (mapplsKey()) return 'mappls';
  return null;
};

export const hasMapKey = () => Boolean(mapProvider());
