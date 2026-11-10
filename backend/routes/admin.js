// /api/admin - Admin dashboard API. Every route needs an admin or site admin
// login; what each may do is defined in lib/roles.js:
//   admin      sees regular users and can create, edit, reset, and delete them
//   siteadmin  sees every account and can do the same to users and admins,
//              including promoting a user to admin or demoting an admin
// Nobody can manage their own account here, and no route grants "siteadmin".
const express = require('express');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { User, BoardAttempt } = require('../models');
const requireAuth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const { isRole, assignableRoles, visibleRoles, canManage } = require('../lib/roles');
const { recomputeBoardStats } = require('../lib/stats');
const {
  publicUser,
  USERNAME_PATTERN,
  EMAIL_PATTERN,
  BCRYPT_ROUNDS,
  asString,
  passwordProblem,
  issuePasswordReset
} = require('./auth');
const { readLimit, escapeRegex } = require('./users');

const router = express.Router();

router.use(requireAuth, requireRole('admin'));

const FORBIDDEN = { error: 'Not allowed', code: 'FORBIDDEN' };
const USERNAME_ERROR = 'Username must be 3-20 letters, numbers, or underscores';
const EMAIL_ERROR = 'A valid email address is required';

// A user as the dashboard shows it, with what the viewing admin may do to it
function adminUser(user, actor) {
  return {
    ...publicUser(user),
    createdAt: user.createdAt,
    // False for accounts that only sign in with GitHub or Google
    hasPassword: Boolean(user.passwordHash),
    manageable: canManage(actor, user)
  };
}

function duplicateMessage(taken, username) {
  return `${taken.username === username ? 'Username' : 'Email'} is already in use`;
}

// Loads :id into req.target; 404 for an unknown or malformed id, 403 for an
// account the admin may not see
router.param('id', async (req, res, next, id) => {
  const target = mongoose.isValidObjectId(id)
    ? await User.findById(id).select('+passwordHash')
    : null;
  if (!target) {
    return res.status(404).json({ error: 'User not found' });
  }
  if (!visibleRoles(req.user.role).includes(target.role || 'user')) {
    return res.status(403).json(FORBIDDEN);
  }
  req.target = target;
  next();
});

// Only accounts whose role ranks below the admin's, and never their own
function requireManageable(req, res, next) {
  if (!canManage(req.user, req.target)) {
    return res.status(403).json(FORBIDDEN);
  }
  next();
}

// GET /api/admin/users?q=&role=&page=&limit= - Accounts the admin can see,
// sorted by username. q matches username, email, first or last name; role is
// one role or a comma-separated list (e.g. admin,siteadmin).
router.get('/users', async (req, res) => {
  const visible = visibleRoles(req.user.role);
  const requested = typeof req.query.role === 'string' && req.query.role
    ? req.query.role.split(',').map((role) => role.trim())
    : null;
  if (requested && !requested.every(isRole)) {
    return res.status(400).json({ error: 'role must be one of: user, admin, siteadmin' });
  }
  if (requested && !requested.every((role) => visible.includes(role))) {
    return res.status(403).json(FORBIDDEN);
  }

  // Accounts from before roles existed have no role field and count as users
  const roles = requested ?? visible;
  const filter = {
    role: { $in: roles.includes('user') ? [...roles, null] : roles }
  };
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (q) {
    const pattern = new RegExp(escapeRegex(q), 'i');
    filter.$or = [
      { username: pattern },
      { email: pattern },
      { firstName: pattern },
      { lastName: pattern }
    ];
  }

  const limit = readLimit(req.query.limit, 20, 100);
  const page = readLimit(req.query.page, 1, 10000);
  const [users, total] = await Promise.all([
    User.find(filter)
      .select('+passwordHash')
      .sort({ username: 1 })
      .skip((page - 1) * limit)
      .limit(limit),
    User.countDocuments(filter)
  ]);

  res.json({
    users: users.map((user) => adminUser(user, req.user)),
    total,
    page,
    limit
  });
});

// GET /api/admin/users/:id - One account
router.get('/users/:id', (req, res) => {
  res.json({ user: adminUser(req.target, req.user) });
});

// POST /api/admin/users - Create an account. It starts verified. Without a
// password, the user is emailed a link to set one.
router.post('/users', async (req, res) => {
  const firstName = asString(req.body?.firstName);
  const lastName = asString(req.body?.lastName);
  const username = asString(req.body?.username);
  const email = asString(req.body?.email).toLowerCase();
  const password = req.body?.password;
  const role = req.body?.role ?? 'user';

  if (!USERNAME_PATTERN.test(username)) {
    return res.status(400).json({ error: USERNAME_ERROR });
  }
  if (!EMAIL_PATTERN.test(email)) {
    return res.status(400).json({ error: EMAIL_ERROR });
  }
  const hasPassword = password !== undefined && password !== null && password !== '';
  if (hasPassword) {
    const problem = passwordProblem(password);
    if (problem) return res.status(400).json({ error: problem });
  }
  if (!isRole(role)) {
    return res.status(400).json({ error: 'role must be one of: user, admin, siteadmin' });
  }
  if (!assignableRoles(req.user.role).includes(role)) {
    return res.status(403).json(FORBIDDEN);
  }

  const taken = await User.findOne({ $or: [{ username }, { email }] });
  if (taken) {
    return res.status(409).json({ error: duplicateMessage(taken, username) });
  }

  let user;
  try {
    user = await User.create({
      firstName,
      lastName,
      username,
      email,
      role,
      emailVerified: true,
      ...(hasPassword && { passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS) })
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Username or email is already in use' });
    }
    throw err;
  }

  if (!hasPassword) {
    await issuePasswordReset(user);
  }
  res.status(201).json({ user: adminUser(user, req.user) });
});

// PATCH /api/admin/users/:id - Change any of firstName, lastName, username,
// email, emailVerified, and role. Fields left out are unchanged.
router.patch('/users/:id', requireManageable, async (req, res) => {
  const body = req.body || {};
  const target = req.target;

  if (body.firstName !== undefined) target.firstName = asString(body.firstName);
  if (body.lastName !== undefined) target.lastName = asString(body.lastName);

  if (body.username !== undefined) {
    const username = asString(body.username);
    if (!USERNAME_PATTERN.test(username)) {
      return res.status(400).json({ error: USERNAME_ERROR });
    }
    target.username = username;
  }
  if (body.email !== undefined) {
    const email = asString(body.email).toLowerCase();
    if (!EMAIL_PATTERN.test(email)) {
      return res.status(400).json({ error: EMAIL_ERROR });
    }
    target.email = email;
  }
  if (body.emailVerified !== undefined) {
    if (typeof body.emailVerified !== 'boolean') {
      return res.status(400).json({ error: 'emailVerified must be true or false' });
    }
    target.emailVerified = body.emailVerified;
  }
  if (body.role !== undefined) {
    if (!isRole(body.role)) {
      return res.status(400).json({ error: 'role must be one of: user, admin, siteadmin' });
    }
    if (!assignableRoles(req.user.role).includes(body.role)) {
      return res.status(403).json(FORBIDDEN);
    }
    target.role = body.role;
  }

  if (target.isModified('username') || target.isModified('email')) {
    const taken = await User.findOne({
      _id: { $ne: target._id },
      $or: [{ username: target.username }, { email: target.email }]
    });
    if (taken) {
      return res.status(409).json({ error: duplicateMessage(taken, target.username) });
    }
  }

  try {
    await target.save();
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Username or email is already in use' });
    }
    throw err;
  }
  res.json({ user: adminUser(target, req.user) });
});

// POST /api/admin/users/:id/password-reset - Email the user a reset link
router.post('/users/:id/password-reset', requireManageable, async (req, res) => {
  await issuePasswordReset(req.target);
  res.json({ message: `Password reset email sent to ${req.target.email}` });
});

// DELETE /api/admin/users/:id - Delete the account and its games. The stats
// of the boards they played are recomputed without those games.
router.delete('/users/:id', requireManageable, async (req, res) => {
  const userId = req.target._id;
  const boardIds = await BoardAttempt.distinct('boardId', { userId });

  await BoardAttempt.deleteMany({ userId });
  await User.deleteOne({ _id: userId });
  await recomputeBoardStats(boardIds);

  res.json({ message: 'User deleted' });
});

module.exports = router;
