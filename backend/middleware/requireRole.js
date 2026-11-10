const { User } = require('../models');
const { hasRole } = require('../lib/roles');

// Use after requireAuth. Loads the logged-in user and allows the request only
// when their role is at least minRole; the user is put at req.user.
//
// The role is read from the database on every request rather than from the
// login token, so promoting or demoting someone takes effect on their next
// request instead of when their token expires.
//
//   401 { error }                       the account no longer exists
//   403 { error, code: 'FORBIDDEN' }    the role is too low
function requireRole(minRole) {
  return async function checkRole(req, res, next) {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(401).json({ error: 'Invalid or expired login token' });
    }
    if (!hasRole(user, minRole)) {
      return res.status(403).json({ error: 'Not allowed', code: 'FORBIDDEN' });
    }
    req.user = user;
    next();
  };
}

module.exports = requireRole;
