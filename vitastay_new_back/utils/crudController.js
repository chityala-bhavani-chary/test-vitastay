const createCrudController = (Model, options = {}) => {
  const {
    includes = [],
    searchFields = [],
    defaultSort = 'created_at',
    sortFields = ['created_at'],
    beforeCreate,
    beforeUpdate,
    filterBuilder,
  } = options;

  return {
    getAll: async (req, res, next) => {
      try {
        const { getPagination, getSort, buildSearchWhere } = require('../utils/pagination');
        const { paginated } = require('../utils/response');
        const { page, limit, offset } = getPagination(req.query);
        const where = filterBuilder ? filterBuilder(req) : {};
        if (req.query.search && searchFields.length) {
          Object.assign(where, buildSearchWhere(req.query.search, searchFields));
        }
        const { count, rows } = await Model.findAndCountAll({
          where,
          include: includes,
          order: getSort(req.query, sortFields, defaultSort),
          limit,
          offset,
        });
        return paginated(res, rows, { page, limit, total: count });
      } catch (err) {
        next(err);
      }
    },

    getById: async (req, res, next) => {
      try {
        const { success, error } = require('../utils/response');
        const record = await Model.findByPk(req.params.id, { include: includes });
        if (!record) return error(res, `${Model.name} not found`, 404);
        return success(res, record);
      } catch (err) {
        next(err);
      }
    },

    create: async (req, res, next) => {
      try {
        const { created, error } = require('../utils/response');
        const data = beforeCreate ? await beforeCreate(req) : req.body;
        const record = await Model.create(data);
        return created(res, record);
      } catch (err) {
        next(err);
      }
    },

    update: async (req, res, next) => {
      try {
        const { success, error } = require('../utils/response');
        const record = await Model.findByPk(req.params.id);
        if (!record) return error(res, `${Model.name} not found`, 404);
        const data = beforeUpdate ? await beforeUpdate(req, record) : req.body;
        await record.update(data);
        return success(res, record, 'Updated successfully');
      } catch (err) {
        next(err);
      }
    },

    remove: async (req, res, next) => {
      try {
        const { success, error } = require('../utils/response');
        const record = await Model.findByPk(req.params.id);
        if (!record) return error(res, `${Model.name} not found`, 404);
        await record.destroy();
        return success(res, null, 'Deleted successfully');
      } catch (err) {
        next(err);
      }
    },
  };
};

module.exports = createCrudController;
