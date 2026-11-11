const { Tenant } = require('../models');
const { error } = require('../utils/response');

const getTenantProfile = async (userId) => {
  return Tenant.findOne({ where: { user_id: userId } });
};

const applyTenantScope = async (req, res, where = {}, options = {}) => {
  const { field = 'tenant_id', allowEmpty = false } = options;

  if (req.user?.role !== 'tenant') {
    return { where, tenant: null, forbidden: false };
  }

  const tenant = await getTenantProfile(req.user.id);
  if (!tenant) {
    if (allowEmpty) {
      return { where: { ...where, [field]: -1 }, tenant: null, forbidden: false };
    }
    return { where, tenant: null, forbidden: true, response: error(res, 'Tenant profile not found', 404) };
  }

  return {
    where: { ...where, [field]: tenant.id },
    tenant,
    forbidden: false,
  };
};

const assertTenantOwnsRecord = async (req, res, recordTenantId) => {
  if (req.user?.role !== 'tenant') return { forbidden: false };

  const tenant = await getTenantProfile(req.user.id);
  if (!tenant) {
    return { forbidden: true, response: error(res, 'Tenant profile not found', 404) };
  }
  if (Number(recordTenantId) !== Number(tenant.id)) {
    return { forbidden: true, response: error(res, 'Forbidden', 403) };
  }
  return { forbidden: false, tenant };
};

module.exports = {
  getTenantProfile,
  applyTenantScope,
  assertTenantOwnsRecord,
};
