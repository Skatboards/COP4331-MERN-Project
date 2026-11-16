// User roles, lowest to highest. A role can do everything the roles below it
// can, plus manage accounts whose role is strictly lower than its own.
//
//   user       plays the game
//   admin      dashboard: view, create, edit, and delete regular users
//   siteadmin  dashboard: the same for users and admins, and can promote a
//              user to admin or demote an admin to user
//
// "siteadmin" is never assigned through the API; it comes from the
// SITE_ADMIN_EMAILS env var (lib/bootstrapAdmins.js) or scripts/set-role.js,
// so no dashboard action can create or remove a site admin.
const ROLES = ['user', 'admin', 'siteadmin'];

function rank(role) {
  const index = ROLES.indexOf(role);
  // Documents created before roles existed have no role and count as "user"
  return index === -1 ? 0 : index;
}

function isRole(value) {
  return ROLES.includes(value);
}

// True when the user's role is at least minRole
function hasRole(user, minRole) {
  return Boolean(user) && rank(user.role) >= rank(minRole);
}

// Roles an actor may give to an account, through create or edit
function assignableRoles(actorRole) {
  if (actorRole === 'siteadmin') return ['user', 'admin'];
  if (actorRole === 'admin') return ['user'];
  return [];
}

// Roles of accounts an actor may see on the dashboard. Site admins see every
// account (other site admins read-only); admins see regular users only.
function visibleRoles(actorRole) {
  if (actorRole === 'siteadmin') return ROLES;
  if (actorRole === 'admin') return ['user'];
  return [];
}

// True when the actor may edit, reset, or delete the target account: the
// target's role must rank below the actor's, and nobody manages themselves
function canManage(actor, target) {
  if (!actor || !target) return false;
  if (String(actor._id) === String(target._id)) return false;
  return rank(actor.role) >= rank('admin') && rank(target.role) < rank(actor.role);
}

module.exports = { ROLES, isRole, hasRole, assignableRoles, visibleRoles, canManage };
