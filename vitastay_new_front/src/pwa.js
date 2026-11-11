/**
 * BKG-017 / BIC-087 — register the service worker in production only.
 * Vite HMR and a SW fight on localhost; the install banner still works in dev.
 */
export const isStandaloneDisplay = () => {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return true;
  return Boolean(window.navigator.standalone);
};

export const registerPwa = () => {
  if (typeof window === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;
  if (!import.meta.env.PROD) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
};
