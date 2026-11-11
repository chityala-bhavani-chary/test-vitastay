/**
 * Privacy-safe listing funnel (BKG-015). Anonymous session id only — never user, email, or IP.
 */
const SESSION_KEY = 'vitastay_listing_sid';

export const listingSessionId = () => {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return `ephemeral-${Date.now()}`;
  }
};

export const trackListingEvent = (idOrSlug, event, extra = {}) => {
  if (!idOrSlug || !event) return;
  const body = JSON.stringify({
    event,
    tab: extra.tab || undefined,
    media_id: extra.media_id || undefined,
    session_id: listingSessionId(),
  });
  const url = `/api/public/listings/${encodeURIComponent(idOrSlug)}/events`;
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {});
};
