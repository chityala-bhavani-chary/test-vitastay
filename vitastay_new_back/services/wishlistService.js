/**
 * BIC-022 — seeker wishlist. Only published marketplace listings.
 */
const { Op } = require('sequelize');
const { Wishlist, Hostel, ListingProjection } = require('../models');
const { toCard } = require('./publicSearch');

const findHostel = async (idOrCode) => {
  const raw = String(idOrCode || '').trim();
  if (!raw) return null;
  if (/^\d+$/.test(raw)) return Hostel.findByPk(raw);
  return Hostel.findOne({ where: { code: { [Op.eq]: raw } } });
};

const assertPublished = async (hostel) => {
  if (!hostel) {
    const err = new Error('Listing not found');
    err.statusCode = 404;
    throw err;
  }
  const projection = await ListingProjection.findOne({
    where: {
      hostel_id: hostel.id,
      is_public: true,
      marketplace_ok: true,
    },
  });
  if (!projection) {
    const err = new Error('Only published listings can be saved');
    err.statusCode = 422;
    throw err;
  }
  return projection;
};

const listForUser = async (userId) => {
  const rows = await Wishlist.findAll({
    where: { user_id: userId },
    order: [['created_at', 'DESC']],
  });
  const hostelIds = rows.map((row) => row.hostel_id);
  if (!hostelIds.length) {
    return { items: [], hostel_ids: [] };
  }
  const projections = await ListingProjection.findAll({
    where: {
      hostel_id: { [Op.in]: hostelIds },
      is_public: true,
      marketplace_ok: true,
    },
  });
  const byId = new Map(projections.map((row) => [row.hostel_id, row]));
  const items = [];
  const liveIds = [];
  for (const id of hostelIds) {
    const projection = byId.get(id);
    if (!projection) continue;
    items.push(toCard(projection));
    liveIds.push(id);
  }
  return { items, hostel_ids: liveIds };
};

const add = async (userId, idOrCode) => {
  const hostel = await findHostel(idOrCode);
  await assertPublished(hostel);
  const [row] = await Wishlist.findOrCreate({
    where: { user_id: userId, hostel_id: hostel.id },
    defaults: { user_id: userId, hostel_id: hostel.id },
  });
  return { hostel_id: hostel.id, code: hostel.code, saved: true, created: row.created_at };
};

const remove = async (userId, idOrCode) => {
  const hostel = await findHostel(idOrCode);
  if (!hostel) {
    const err = new Error('Listing not found');
    err.statusCode = 404;
    throw err;
  }
  const deleted = await Wishlist.destroy({
    where: { user_id: userId, hostel_id: hostel.id },
  });
  return { hostel_id: hostel.id, code: hostel.code, saved: false, removed: deleted > 0 };
};

const isSaved = async (userId, hostelId) => {
  if (!userId || !hostelId) return false;
  const count = await Wishlist.count({ where: { user_id: userId, hostel_id: hostelId } });
  return count > 0;
};

module.exports = {
  findHostel,
  assertPublished,
  listForUser,
  add,
  remove,
  isSaved,
};
