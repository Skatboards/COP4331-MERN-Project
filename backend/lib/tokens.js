const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// --- One-time tokens (email verification, password reset) ------------------

// Returns the token to email to the user and the hash to store in the database
function createOneTimeToken() {
  const token = crypto.randomBytes(32).toString('hex');
  return { token, hash: hashToken(token) };
}

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

// --- Login tokens (JWT) ----------------------------------------------------

// Without JWT_SECRET a random secret is used, which is secure but logs
// everyone out whenever the backend restarts. Set JWT_SECRET in production.
let jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  jwtSecret = crypto.randomBytes(32).toString('hex');
  if (process.env.NODE_ENV !== 'test') {
    console.warn('JWT_SECRET is not set; using a random secret for this run');
  }
}

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1d';

function signLoginToken(user) {
  return jwt.sign({ sub: String(user._id) }, jwtSecret, {
    expiresIn: JWT_EXPIRES_IN
  });
}

// Returns the user id, or throws if the token is invalid or expired
function verifyLoginToken(token) {
  return jwt.verify(token, jwtSecret).sub;
}

module.exports = {
  createOneTimeToken,
  hashToken,
  signLoginToken,
  verifyLoginToken
};
