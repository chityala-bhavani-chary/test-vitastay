module.exports = (sequelize, DataTypes) => {
  const Hostel = sequelize.define('Hostel', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    owner_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    name: { type: DataTypes.STRING(255), allowNull: false },
    code: { type: DataTypes.STRING(50), unique: true },
    description: DataTypes.TEXT,
    description_hi: DataTypes.TEXT,
    name_hi: DataTypes.STRING(255),
    description_draft: DataTypes.TEXT,
    description_draft_source: {
      type: DataTypes.ENUM('template', 'llm'),
      allowNull: true,
    },
    description_draft_at: DataTypes.DATE,
    description_origin: {
      type: DataTypes.ENUM('owner', 'template', 'llm'),
      allowNull: true,
    },
    address: { type: DataTypes.TEXT, allowNull: false },
    city: { type: DataTypes.STRING(100), allowNull: false },
    area: DataTypes.STRING(120),
    state: { type: DataTypes.STRING(100), allowNull: false },
    pincode: { type: DataTypes.STRING(10), allowNull: false },
    country: { type: DataTypes.STRING(100), defaultValue: 'India' },
    latitude: DataTypes.DECIMAL(10, 8),
    longitude: DataTypes.DECIMAL(11, 8),
    total_floors: { type: DataTypes.INTEGER, defaultValue: 1 },
    capacity: { type: DataTypes.INTEGER, defaultValue: 0 },
    amenities: DataTypes.JSON,
    features: {
      type: DataTypes.JSON,
      defaultValue: {
        rooms: true,
        tenants: true,
        rent: true,
        expenses: true,
        visitors: true,
        complaints: true,
        maintenance: true,
        notices: true,
        staff: true,
        attendance: true,
        inventory: true,
        reports: true,
      },
    },
    electricity_charge: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
    water_charge: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
    security_deposit: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
    notice_period_months: { type: DataTypes.INTEGER, defaultValue: 1 },
    images: DataTypes.JSON,
    logo: DataTypes.STRING(255),
    contact_phone: DataTypes.STRING(20),
    contact_email: DataTypes.STRING(255),
    database_name: DataTypes.STRING(64),
    status: { type: DataTypes.ENUM('pending_approval', 'active', 'inactive', 'maintenance', 'on_hold', 'rejected'), defaultValue: 'pending_approval' },
    gender_policy: {
      type: DataTypes.ENUM('male', 'female', 'unisex'),
      allowNull: false,
      defaultValue: 'unisex',
    },
    listing_published: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    listing_published_at: DataTypes.DATE,
    listing_moderated_by: DataTypes.INTEGER.UNSIGNED,
    listing_moderated_at: DataTypes.DATE,
    listing_unpublish_reason: DataTypes.STRING(500),
    media_override_reason: DataTypes.STRING(500),
    media_override_by: DataTypes.INTEGER.UNSIGNED,
    media_override_at: DataTypes.DATE,
    plan: {
      type: DataTypes.ENUM('regular', 'silver', 'gold'),
      allowNull: false,
      defaultValue: 'regular',
    },
    plan_period: { type: DataTypes.ENUM('month', 'year'), allowNull: true },
    plan_status: {
      type: DataTypes.ENUM('comp', 'active', 'grace', 'lapsed', 'pending'),
      allowNull: false,
      defaultValue: 'comp',
    },
    plan_starts_at: DataTypes.DATE,
    plan_expires_at: DataTypes.DATE,
    plan_grace_ends_at: DataTypes.DATE,
    booking_model: {
      type: DataTypes.ENUM('approval_first', 'instant', 'request_advance'),
      allowNull: false,
      defaultValue: 'approval_first',
    },
    advance_percent: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 20 },
    // DEC-05: assigned supervisors upload listing photos by default; owner may turn off.
    supervisor_media_upload: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    owner_kyc_status: {
      type: DataTypes.ENUM('none', 'submitted', 'verified', 'rejected'),
      allowNull: false,
      defaultValue: 'none',
    },
    owner_pan_cipher: DataTypes.TEXT,
    owner_gstin_cipher: DataTypes.TEXT,
    owner_upi_cipher: DataTypes.TEXT,
    owner_kyc_reject_reason: DataTypes.TEXT,
    owner_kyc_verified_at: DataTypes.DATE,
    owner_kyc_verified_by: DataTypes.INTEGER.UNSIGNED,
    owner_kyc_submitted_at: DataTypes.DATE,
    verified_at: DataTypes.DATE,
    verified_by: DataTypes.INTEGER.UNSIGNED,
  }, {
    tableName: 'hostels',
    defaultScope: {
      attributes: { exclude: ['owner_pan_cipher', 'owner_gstin_cipher', 'owner_upi_cipher'] },
    },
  });

  Hostel.associate = (models) => {
    Hostel.belongsTo(models.User, { foreignKey: 'owner_id', as: 'owner' });
    Hostel.hasMany(models.HostelBlock, { foreignKey: 'hostel_id', as: 'blocks' });
    Hostel.hasMany(models.Room, { foreignKey: 'hostel_id', as: 'rooms' });
    Hostel.hasMany(models.Tenant, { foreignKey: 'hostel_id', as: 'tenants' });
    Hostel.hasMany(models.Staff, { foreignKey: 'hostel_id', as: 'staffMembers' });
    Hostel.hasMany(models.Expense, { foreignKey: 'hostel_id', as: 'expenses' });
    Hostel.hasMany(models.Visitor, { foreignKey: 'hostel_id', as: 'visitors' });
    Hostel.hasMany(models.Complaint, { foreignKey: 'hostel_id', as: 'complaints' });
    Hostel.hasMany(models.Maintenance, { foreignKey: 'hostel_id', as: 'maintenanceRecords' });
    Hostel.hasMany(models.Notice, { foreignKey: 'hostel_id', as: 'notices' });
    Hostel.hasMany(models.InventoryItem, { foreignKey: 'hostel_id', as: 'inventory' });
    Hostel.belongsToMany(models.User, { through: models.SupervisorHostel, foreignKey: 'hostel_id', as: 'supervisors' });
    if (models.PropertyMedia) {
      Hostel.hasMany(models.PropertyMedia, { foreignKey: 'hostel_id', as: 'media' });
    }
    if (models.ListingProjection) {
      Hostel.hasOne(models.ListingProjection, { foreignKey: 'hostel_id', as: 'listingProjection' });
    }
    if (models.ListingAvailability) {
      Hostel.hasMany(models.ListingAvailability, { foreignKey: 'hostel_id', as: 'listingAvailability' });
    }
    if (models.Booking) {
      Hostel.hasMany(models.Booking, { foreignKey: 'hostel_id', as: 'bookings' });
    }
    if (models.FaceEnrollment) {
      Hostel.hasMany(models.FaceEnrollment, { foreignKey: 'hostel_id', as: 'faceEnrollments' });
    }
    if (models.FaceWatchlist) {
      Hostel.hasMany(models.FaceWatchlist, { foreignKey: 'hostel_id', as: 'faceWatchlist' });
    }
    if (models.FaceEvent) {
      Hostel.hasMany(models.FaceEvent, { foreignKey: 'hostel_id', as: 'faceEvents' });
    }
  };

  return Hostel;
};
