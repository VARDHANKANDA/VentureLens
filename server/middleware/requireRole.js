'use strict';
const VALID_ROLES = ['Founder', 'Investor'];
function requireRole(role) {
  return function (req, res, next) {
    if (!VALID_ROLES.includes(req.session.role) || req.session.role !== role) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}
module.exports = requireRole;