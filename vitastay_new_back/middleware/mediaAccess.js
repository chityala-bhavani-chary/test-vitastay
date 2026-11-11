const { Hostel, SupervisorHostel } = require('../models');
const { error } = require('../utils/response');

const supervisorMediaUploadEnabled = (hostel) => (
  hostel?.supervisor_media_upload !== false && hostel?.supervisor_media_upload !== 0
);

const userCanManageHostelMedia = async (user, hostel) => {
  if (!user || !hostel) return false;
  if (user.role === 'super_admin') return true;
  if (user.role === 'owner') return Number(hostel.owner_id) === Number(user.id);
  if (user.role === 'supervisor') {
    const assigned = await SupervisorHostel.findOne({
      where: { supervisor_id: user.id, hostel_id: hostel.id },
    });
    return Boolean(assigned);
  }
  return false;
};

/** DEC-05: supervisors mutate listing photos only when the hostel toggle is on. */
const userCanMutateHostelMedia = async (user, hostel) => {
  if (!(await userCanManageHostelMedia(user, hostel))) return false;
  if (user.role === 'supervisor' && !supervisorMediaUploadEnabled(hostel)) return false;
  return true;
};

const isMediaReadMethod = (method) => {
  const m = String(method || '').toUpperCase();
  return m === 'GET' || m === 'HEAD' || m === 'OPTIONS';
};

/**
 * Super Admin may act on any hostel (bypasses owner_id).
 * Owner: owner_id match. Supervisor: SupervisorHostel assignment only.
 * Mutations: supervisor needs hostels.supervisor_media_upload (default true).
 */
const loadHostelForMedia = async (req, res, next) => {
  try {
    const hostelId = req.params.hostelId || req.params.id;
    const hostel = await Hostel.findByPk(hostelId);
    if (!hostel) return error(res, 'Hostel not found', 404);

    const canSee = await userCanManageHostelMedia(req.user, hostel);
    if (!canSee) {
      if (req.user?.role === 'supervisor') {
        return error(res, 'This hostel is not assigned to you', 403);
      }
      return error(res, 'Forbidden', 403);
    }

    if (!isMediaReadMethod(req.method) && !(await userCanMutateHostelMedia(req.user, hostel))) {
      return error(
        res,
        'Owner has turned off supervisor photo uploads for this hostel. Ask the owner or Super Admin.',
        403,
      );
    }

    req.hostel = hostel;
    return next();
  } catch (err) {
    next(err);
  }
};

module.exports = {
  loadHostelForMedia,
  userCanManageHostelMedia,
  userCanMutateHostelMedia,
  supervisorMediaUploadEnabled,
};
