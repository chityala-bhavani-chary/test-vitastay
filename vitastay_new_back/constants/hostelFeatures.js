const HOSTEL_FEATURE_KEYS = [
  'rooms',
  'tenants',
  'rent',
  'expenses',
  'visitors',
  'complaints',
  'maintenance',
  'notices',
  'staff',
  'attendance',
  'inventory',
  'reports',
];

const HOSTEL_FEATURE_LABELS = {
  rooms: 'Rooms & Beds',
  tenants: 'Tenants',
  rent: 'Rent Collection',
  expenses: 'Expenses',
  visitors: 'Visitors',
  complaints: 'Complaints',
  maintenance: 'Maintenance',
  notices: 'Notices',
  staff: 'Staff',
  attendance: 'Attendance',
  inventory: 'Inventory',
  reports: 'Reports',
};

const DEFAULT_HOSTEL_FEATURES = HOSTEL_FEATURE_KEYS.reduce((acc, key) => {
  acc[key] = true;
  return acc;
}, {});

const AMENITY_OPTIONS = [
  'WiFi',
  'AC',
  'Laundry',
  'Gym',
  'CCTV',
  'Power Backup',
  'Mess / Food',
  'Parking',
  'Hot Water',
  'Housekeeping',
  'Study Room',
  'RO Water',
];

const normalizeFeatures = (features = {}) => {
  const normalized = { ...DEFAULT_HOSTEL_FEATURES };
  HOSTEL_FEATURE_KEYS.forEach((key) => {
    if (typeof features[key] === 'boolean') {
      normalized[key] = features[key];
    }
  });
  return normalized;
};

module.exports = {
  HOSTEL_FEATURE_KEYS,
  HOSTEL_FEATURE_LABELS,
  DEFAULT_HOSTEL_FEATURES,
  AMENITY_OPTIONS,
  normalizeFeatures,
};
