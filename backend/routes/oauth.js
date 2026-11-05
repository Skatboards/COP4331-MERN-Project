const crypto = require('crypto');
const express = require('express');
const { User } = require('../models');
const { signLoginToken } = require('../lib/tokens');
const { APP_URL } = require('../lib/email');
const {
  PROVIDERS,
  isEnabled,
  enabledProviders,
  createLoginAttempt,
  authorizeUrl,
  exchangeCode,
  getProfile
} = require('../lib/oauth');

const router = express.Router();

// Holds the state and PKCE verifier between the redirect out and the callback
const COOKIE_NAME = 'oauth_login';
const COOKIE_PATH = '/api/auth';
const COOKIE_MAX_AGE_S = 10 * 60;

function redirectUri(provider) {
  return `${APP_URL}/api/auth/${provider}/callback`;
}

function readCookie(req, name) {
  for (const part of (req.get('Cookie') || '').split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) {
      return decodeURIComponent(value.join('='));
    }
  }
  return null;
}

function setLoginCookie(res, value, maxAge) {
  const secure = APP_URL.startsWith('https://') ? '; Secure' : '';
  res.set(
    'Set-Cookie',
    `${COOKIE_NAME}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=${COOKIE_PATH}; HttpOnly; SameSite=Lax${secure}`
  );
}

function sameString(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

// Fits a GitHub login or email name to the username rules (3-20 letters,
// numbers, or underscores) and adds digits until it is not taken
async function availableUsername(suggested) {
  let base = (suggested || '').replace(/[^A-Za-z0-9_]/g, '_').slice(0, 20);
  if (base.length < 3) {
    base = `player${base}`.slice(0, 20);
  }
  if (!(await User.exists({ username: base }))) {
    return base;
  }
  for (let i = 0; i < 10; i += 1) {
    const candidate = `${base.slice(0, 15)}_${crypto.randomInt(1000, 10000)}`;
    if (!(await User.exists({ username: candidate }))) {
      return candidate;
    }
  }
  throw new Error('Could not find a free username');
}

// Two sign-ins at the same moment can both pass the checks above and then
// clash on a unique index (same username, email, or provider account). The
// second one then looks again, which finds the first one's user or a free
// username.
async function findOrCreateUser(provider, profile, attempts = 3) {
  try {
    return await findOrCreateUserOnce(provider, profile);
  } catch (err) {
    if (err.code === 11000 && attempts > 1) {
      return findOrCreateUser(provider, profile, attempts - 1);
    }
    throw err;
  }
}

// The user who signed in with this provider before, else the user with the
// same verified email (now linked), else a new user. Returns null if the
// provider did not give a verified email.
async function findOrCreateUserOnce(provider, profile) {
  const account = { provider, providerId: profile.providerId };

  const returning = await User.findOne({ oauthAccounts: { $elemMatch: account } });
  if (returning) {
    return returning;
  }

  if (!profile.email || !profile.emailVerified) {
    return null;
  }

  const existing = await User.findOne({ email: profile.email });
  if (existing) {
    if (!existing.emailVerified) {
      // Whoever set this password never proved they own the address (someone
      // could register the owner's email in advance), so drop it and any
      // pending reset; the owner can set a password with "forgot password"
      existing.passwordHash = undefined;
      existing.passwordResetTokenHash = null;
      existing.passwordResetExpires = null;
    }
    existing.oauthAccounts = [...(existing.oauthAccounts || []), account];
    // The provider has confirmed the address
    existing.emailVerified = true;
    existing.emailVerificationTokenHash = null;
    existing.emailVerificationExpires = null;
    await existing.save();
    return existing;
  }

  return User.create({
    firstName: profile.firstName,
    lastName: profile.lastName,
    username: await availableUsername(profile.suggestedUsername),
    email: profile.email,
    emailVerified: true,
    oauthAccounts: [account]
  });
}

function backToSite(res, error) {
  res.redirect(`${APP_URL}/?oauthError=${error}`);
}

// GET /api/auth/providers - The ways to sign in, so the client can show
// only the buttons that work
router.get('/providers', (req, res) => {
  res.json({
    providers: [
      { id: 'password', name: 'Email and password' },
      ...enabledProviders().map((id) => ({ id, name: PROVIDERS[id].name }))
    ]
  });
});

// Unknown or unconfigured providers get a 404
router.param('provider', (req, res, next, provider) => {
  if (!isEnabled(provider)) {
    return res.status(404).json({ error: 'Sign-in provider not available' });
  }
  next();
});

// GET /api/auth/:provider - Start signing in with GitHub or Google
router.get('/:provider', (req, res) => {
  const { provider } = req.params;
  const { state, verifier, challenge } = createLoginAttempt();
  setLoginCookie(res, `${provider}.${state}.${verifier}`, COOKIE_MAX_AGE_S);
  res.redirect(authorizeUrl(provider, { state, challenge, redirectUri: redirectUri(provider) }));
});

// GET /api/auth/:provider/callback - The provider sends the browser back
// here; on success the site gets our login token in the URL fragment
router.get('/:provider/callback', async (req, res) => {
  const { provider } = req.params;
  const { code, state, error } = req.query;
  const [cookieProvider, cookieState, verifier] = (readCookie(req, COOKIE_NAME) || '').split('.');
  setLoginCookie(res, '', 0);

  if (error) {
    // For example, the user pressed Cancel on the provider's page
    return backToSite(res, 'cancelled');
  }
  if (
    typeof code !== 'string' ||
    typeof state !== 'string' ||
    cookieProvider !== provider ||
    !verifier ||
    !sameString(state, cookieState)
  ) {
    return backToSite(res, 'state');
  }

  let profile;
  try {
    const accessToken = await exchangeCode(provider, {
      code,
      verifier,
      redirectUri: redirectUri(provider)
    });
    profile = await getProfile(provider, accessToken);
  } catch (err) {
    console.error(`Sign-in with ${provider} failed:`, err.message);
    return backToSite(res, 'provider');
  }

  let user;
  try {
    user = await findOrCreateUser(provider, profile);
  } catch (err) {
    console.error(`Sign-in with ${provider} could not save the user:`, err.message);
    return backToSite(res, 'failed');
  }
  if (!user) {
    return backToSite(res, 'email');
  }

  // The fragment is not sent to servers, so the token stays out of logs
  res.redirect(`${APP_URL}/#token=${signLoginToken(user)}`);
});

module.exports = router;
