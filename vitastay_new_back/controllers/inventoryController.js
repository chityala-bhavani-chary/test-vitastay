const { InventoryItem, InventoryTransaction, Hostel } = require('../models');
const createCrudController = require('../utils/crudController');
const { success } = require('../utils/response');

const base = createCrudController(InventoryItem, {
  includes: [{ model: Hostel, as: 'hostel', attributes: ['id', 'name'] }],
  searchFields: ['name', 'location'],
  filterBuilder: (req) => {
    const where = {};
    if (req.query.hostelId) where.hostel_id = req.query.hostelId;
    if (req.query.category) where.category = req.query.category;
    return where;
  },
});

exports.getAll = base.getAll;
exports.getById = base.getById;
exports.create = base.create;
exports.update = base.update;
exports.remove = base.remove;

exports.adjustStock = async (req, res, next) => {
  try {
    const item = await InventoryItem.findByPk(req.params.id);
    if (!item) return require('../utils/response').error(res, 'Item not found', 404);

    const { type, quantity, remarks } = req.body;
    const prevQty = item.quantity;
    let newQty = prevQty;

    if (type === 'in') newQty += quantity;
    else if (type === 'out' || type === 'damage') newQty -= quantity;
    else if (type === 'adjustment') newQty = quantity;

    let status = 'available';
    if (newQty <= 0) status = 'out_of_stock';
    else if (newQty <= item.min_stock) status = 'low_stock';

    await item.update({ quantity: Math.max(0, newQty), status });
    await InventoryTransaction.create({
      item_id: item.id,
      type,
      quantity,
      previous_quantity: prevQty,
      new_quantity: Math.max(0, newQty),
      remarks,
      performed_by: req.user.id,
    });

    return success(res, item, 'Stock updated');
  } catch (err) {
    next(err);
  }
};
