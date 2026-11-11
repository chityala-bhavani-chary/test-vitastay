const { AuditLog } = require('../models');

const createAuditLog = async ({ userId, action, entityType, entityId, oldValues, newValues, req }) => {
  try {
    await AuditLog.create({
      user_id: userId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      old_values: oldValues,
      new_values: newValues,
      ip_address: req?.ip || req?.headers?.['x-forwarded-for'],
      user_agent: req?.headers?.['user-agent'],
    });
  } catch (err) {
    // Non-blocking audit logging
  }
};

module.exports = { createAuditLog };
