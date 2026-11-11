const getPagination = (query) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 10));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
};

const getSort = (query, allowedFields = ['created_at'], defaultSort = 'created_at') => {
  const sortBy = allowedFields.includes(query.sortBy) ? query.sortBy : defaultSort;
  const sortOrder = query.sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  return [[sortBy, sortOrder]];
};

const buildSearchWhere = (search, fields) => {
  if (!search) return {};
  const { Op } = require('sequelize');
  return {
    [Op.or]: fields.map((field) => ({ [field]: { [Op.like]: `%${search}%` } })),
  };
};

const parseDateRange = (query) => {
  const { startDate, endDate } = query;
  if (!startDate && !endDate) return {};
  const { Op } = require('sequelize');
  const range = {};
  if (startDate) range[Op.gte] = startDate;
  if (endDate) range[Op.lte] = endDate;
  return { created_at: range };
};

module.exports = { getPagination, getSort, buildSearchWhere, parseDateRange };
