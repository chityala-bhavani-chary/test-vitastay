const { error } = require('../utils/response');

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return error(res, 'Unauthorized', 401);
    }
    if (!roles.includes(req.user.role)) {
      return error(res, 'Forbidden: insufficient permissions', 403);
    }
    next();
  };
};

const PERMISSIONS = {
  super_admin: ['*'],
  owner: ['*'],
  supervisor: [
    'hostels:read', 'rooms:*', 'beds:*', 'tenants:*', 'staff:*',
    'rent:*', 'expenses:*', 'visitors:*', 'complaints:*', 'maintenance:*',
    'notices:*', 'attendance:*', 'inventory:*', 'reports:read', 'documents:*',
  ],
  tenant: [
    'profile:read', 'profile:update', 'rent:read', 'rent:pay',
    'complaints:create', 'complaints:read', 'visitors:create', 'visitors:read',
    'documents:read', 'notices:read', 'notifications:read',
  ],
  staff: [
    'attendance:read', 'complaints:read', 'maintenance:read', 'notices:read',
  ],
  seeker: [
    'profile:read', 'profile:update', 'notifications:read', 'bookings:*',
  ],
};

const checkPermission = (permission) => {
  return (req, res, next) => {
    const userPerms = PERMISSIONS[req.user.role] || [];
    const hasPermission = userPerms.includes('*')
      || userPerms.includes(permission)
      || userPerms.some((p) => {
        const [module] = permission.split(':');
        return p === `${module}:*`;
      });

    if (!hasPermission) {
      return error(res, 'Forbidden: insufficient permissions', 403);
    }
    next();
  };
};

module.exports = { authorize, checkPermission, PERMISSIONS };
