const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const { User } = require('../models');
const { createOneTimeToken, hashToken, signLoginToken } = require('../lib/tokens');
const {
  APP_URL,
  sendVerificationEmail,
  sendPasswordResetEmail
} = require('../lib/email');

const router = express.Router();

const BCRYPT_ROUNDS = 10;
const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
// bcrypt only uses the first 72 bytes of a password
const MAX_PASSWORD_LENGTH = 72;

// Compared against when the user does not exist, so a failed login takes
// about as long whether or not the username is real. It is a hash of random
// bytes made at startup, so no password can match it.
const DUMMY_HASH = bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), BCRYPT_ROUNDS);

// Shared reply for requests that must not reveal whether an email is registered
const CHECK_EMAIL_MESSAGE = 'If that email belongs to an account, a message has been sent to it.';

function asString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function passwordProblem(password) {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  if (Buffer.byteLength(password) > MAX_PASSWORD_LENGTH) {
    return `Password must be at most ${MAX_PASSWORD_LENGTH} bytes`;
  }
  return null;
}

// Fields that are safe to send back to the client
function publicUser(user) {
  return {
    id: user._id,
    firstName: user.firstName,
    lastName: user.lastName,
    username: user.username,
    email: user.email,
    emailVerified: user.emailVerified,
    totalClicks: user.totalClicks,
    boardsCompleted: user.boardsCompleted,
    efficiency: user.efficiency
  };
}

// Emails are sent after the reply is decided; a mail failure is logged
// rather than failing the request (the user can ask for a new email)
function sendInBackground(promise) {
  promise.catch((err) => console.error('Failed to send email:', err.message));
}

// POST /api/auth/register - Create an account and email a verification link
router.post('/register', async (req, res) => {
  const firstName = asString(req.body?.firstName);
  const lastName = asString(req.body?.lastName);
  const username = asString(req.body?.username);
  const email = asString(req.body?.email).toLowerCase();
  const password = req.body?.password;

  if (!USERNAME_PATTERN.test(username)) {
    return res.status(400).json({
      error: 'Username must be 3-20 letters, numbers, or underscores'
    });
  }
  if (!EMAIL_PATTERN.test(email)) {
    return res.status(400).json({ error: 'A valid email address is required' });
  }
  const problem = passwordProblem(password);
  if (problem) {
    return res.status(400).json({ error: problem });
  }

  const taken = await User.findOne({ $or: [{ username }, { email }] });
  if (taken) {
    const field = taken.username === username ? 'Username' : 'Email';
    return res.status(409).json({ error: `${field} is already in use` });
  }

  const { token, hash } = createOneTimeToken();
  let user;
  try {
    user = await User.create({
      firstName,
      lastName,
      username,
      email,
      passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
      emailVerificationTokenHash: hash,
      emailVerificationExpires: new Date(Date.now() + VERIFY_TOKEN_TTL_MS)
    });
  } catch (err) {
    // Another request registered the same name between the check and insert
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Username or email is already in use' });
    }
    throw err;
  }

  sendInBackground(sendVerificationEmail(user, token));
  res.status(201).json({
    message: 'Account created. Check your email to verify your address before logging in.',
    user: publicUser(user)
  });
});

// Marks the user with this verification token as verified; returns false if
// the token is unknown or expired
async function verifyEmailToken(token) {
  if (typeof token !== 'string' || !token) {
    return false;
  }
  const user = await User.findOneAndUpdate(
    {
      emailVerificationTokenHash: hashToken(token),
      emailVerificationExpires: { $gt: new Date() }
    },
    {
      $set: {
        emailVerified: true,
        emailVerificationTokenHash: null,
        emailVerificationExpires: null
      }
    }
  );
  return Boolean(user);
}

// GET /api/auth/verify-email?token= - The link in the verification email;
// verifies the address and sends the browser back to the site
router.get('/verify-email', async (req, res) => {
  const verified = await verifyEmailToken(req.query.token);
  res.redirect(`${APP_URL}/?verified=${verified ? 1 : 0}`);
});

// POST /api/auth/verify-email - The same check for API clients (mobile app)
router.post('/verify-email', async (req, res) => {
  if (!(await verifyEmailToken(req.body?.token))) {
    return res.status(400).json({ error: 'Verification link is invalid or has expired' });
  }
  res.json({ message: 'Email verified. You can now log in.' });
});

// POST /api/auth/resend-verification - Email a new verification link
router.post('/resend-verification', async (req, res) => {
  const email = asString(req.body?.email).toLowerCase();
  const user = email ? await User.findOne({ email, emailVerified: { $ne: true } }) : null;

  if (user) {
    const { token, hash } = createOneTimeToken();
    user.emailVerificationTokenHash = hash;
    user.emailVerificationExpires = new Date(Date.now() + VERIFY_TOKEN_TTL_MS);
    await user.save();
    sendInBackground(sendVerificationEmail(user, token));
  }
  res.json({ message: CHECK_EMAIL_MESSAGE });
});

// POST /api/auth/login - Log in with a username or email and a password
router.post('/login', async (req, res) => {
  const login = asString(req.body?.login);
  const password = req.body?.password;

  if (!login || typeof password !== 'string' || !password) {
    return res.status(400).json({ error: 'Username or email and password are required' });
  }

  const user = await User.findOne(
    login.includes('@') ? { email: login.toLowerCase() } : { username: login }
  ).select('+passwordHash');

  const passwordMatches = await bcrypt.compare(password, user?.passwordHash || DUMMY_HASH);
  if (!user || !passwordMatches) {
    return res.status(401).json({ error: 'Incorrect username or password' });
  }
  if (!user.emailVerified) {
    return res.status(403).json({
      error: 'Verify your email address before logging in',
      code: 'EMAIL_NOT_VERIFIED'
    });
  }

  res.json({ token: signLoginToken(user), user: publicUser(user) });
});

// POST /api/auth/forgot-password - Email a password reset link
router.post('/forgot-password', async (req, res) => {
  const email = asString(req.body?.email).toLowerCase();
  const user = email ? await User.findOne({ email }) : null;

  if (user) {
    const { token, hash } = createOneTimeToken();
    user.passwordResetTokenHash = hash;
    user.passwordResetExpires = new Date(Date.now() + RESET_TOKEN_TTL_MS);
    await user.save();
    sendInBackground(sendPasswordResetEmail(user, token));
  }
  res.json({ message: CHECK_EMAIL_MESSAGE });
});

// POST /api/auth/reset-password - Set a new password with the emailed token
router.post('/reset-password', async (req, res) => {
  const token = req.body?.token;
  const password = req.body?.password;

  const problem = passwordProblem(password);
  if (problem) {
    return res.status(400).json({ error: problem });
  }
  if (typeof token !== 'string' || !token) {
    return res.status(400).json({ error: 'Reset link is invalid or has expired' });
  }

  const user = await User.findOneAndUpdate(
    {
      passwordResetTokenHash: hashToken(token),
      passwordResetExpires: { $gt: new Date() }
    },
    {
      $set: {
        passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
        passwordResetTokenHash: null,
        passwordResetExpires: null,
        // Getting the reset email proves the user owns the address
        emailVerified: true
      }
    }
  );
  if (!user) {
    return res.status(400).json({ error: 'Reset link is invalid or has expired' });
  }
  res.json({ message: 'Password updated. You can now log in.' });
});

module.exports = router;
module.exports.publicUser = publicUser;
