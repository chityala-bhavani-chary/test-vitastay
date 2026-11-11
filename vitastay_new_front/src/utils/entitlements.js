export const ROUTE_ENTITLEMENT = {
  '/booking-requests': 'online_booking',
  '/listing-analytics': 'listing_analytics',
};

export const unionEntitlements = (hostels = []) => {
  const flags = {
    erp: true,
    occupancy: true,
    revenue: true,
    public_search: false,
    online_booking: false,
    tenant_portal: false,
    listing_analytics: false,
    listing_publish: false,
    vita_eye: false,
    full_product: false,
  };
  hostels.forEach((hostel) => {
    const row = hostel?.entitlements || {};
    Object.keys(row).forEach((key) => {
      if (row[key]) flags[key] = true;
    });
  });
  return flags;
};

export const flagForPath = (path) => {
  const base = `/${String(path || '').split('/').filter(Boolean)[0] || ''}`;
  return ROUTE_ENTITLEMENT[base] || ROUTE_ENTITLEMENT[path] || null;
};

export const PLATFORM_ENTITLEMENTS = {
  erp: true,
  occupancy: true,
  revenue: true,
  public_search: true,
  online_booking: true,
  tenant_portal: true,
  listing_analytics: true,
  listing_publish: true,
  vita_eye: true,
  full_product: true,
};
