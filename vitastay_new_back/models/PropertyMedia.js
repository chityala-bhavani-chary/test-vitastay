const { Op } = require('sequelize');

const CATEGORIES = ['exterior', 'interior_common', 'room', 'floor', 'panorama_360', 'walkthrough_video'];
const CAPTURE_KINDS = ['photo', 'panorama_360', 'video'];

module.exports = (sequelize, DataTypes) => {
  const PropertyMedia = sequelize.define('PropertyMedia', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    hostel_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    category: {
      type: DataTypes.ENUM(...CATEGORIES),
      allowNull: false,
    },
    capture_kind: {
      type: DataTypes.ENUM(...CAPTURE_KINDS),
      allowNull: false,
      defaultValue: 'photo',
    },
    // room_id is not a FK: rooms may live only in isolated hostel DBs.
    room_id: DataTypes.INTEGER.UNSIGNED,
    room_number: DataTypes.STRING(20),
    floor_number: DataTypes.INTEGER,
    title: DataTypes.STRING(150),
    caption: DataTypes.STRING(200),
    file_path: { type: DataTypes.STRING(500), allowNull: false },
    thumb_path: DataTypes.STRING(500),
    mime_type: { type: DataTypes.STRING(100), allowNull: false },
    file_size: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    width: DataTypes.INTEGER.UNSIGNED,
    height: DataTypes.INTEGER.UNSIGNED,
    sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    is_cover: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    is_published: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    uploaded_by: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  }, {
    tableName: 'property_media',
    timestamps: true,
    underscored: true,
    paranoid: true,
    indexes: [
      { name: 'idx_media_hostel_cat', fields: ['hostel_id', 'category', 'deleted_at'] },
      { name: 'idx_media_room', fields: ['room_id'] },
      { name: 'uk_property_media_hostel_path', unique: true, fields: ['hostel_id', 'file_path'] },
    ],
    validate: {
      roomCategoryRequiresRoomId() {
        if (this.category === 'room' && !this.room_id) {
          throw new Error('Room is required for room photos');
        }
      },
      floorCategoryRequiresFloorNumber() {
        if (this.category === 'floor' && (this.floor_number === null || this.floor_number === undefined)) {
          throw new Error('Floor is required for floor photos');
        }
      },
      panoramaRequiresCaptureKind() {
        if (this.category === 'panorama_360' && this.capture_kind !== 'panorama_360') {
          throw new Error('360° category requires capture_kind panorama_360');
        }
      },
    },
    hooks: {
      beforeValidate(instance) {
        if (instance.category === 'panorama_360') {
          instance.capture_kind = 'panorama_360';
        }
      },
      async beforeSave(instance, options) {
        if (!instance.is_cover) return;
        const where = {
          hostel_id: instance.hostel_id,
          is_cover: true,
        };
        if (instance.id) {
          where.id = { [Op.ne]: instance.id };
        }
        await PropertyMedia.update(
          { is_cover: false },
          { where, transaction: options.transaction, hooks: false }
        );
      },
    },
  });

  PropertyMedia.CATEGORIES = CATEGORIES;
  PropertyMedia.CAPTURE_KINDS = CAPTURE_KINDS;

  PropertyMedia.associate = (models) => {
    if (models.Hostel) {
      PropertyMedia.belongsTo(models.Hostel, { foreignKey: 'hostel_id', as: 'hostel' });
    }
    if (models.User) {
      PropertyMedia.belongsTo(models.User, { foreignKey: 'uploaded_by', as: 'uploader' });
    }
  };

  return PropertyMedia;
};
