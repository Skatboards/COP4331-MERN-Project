const { verifyLoginToken } = require('../lib/tokens');

// Requires "Authorization: Bearer <token>" from POST /api/auth/login and
// puts the logged-in user's id at req.userId
function requireAuth(req, res, next) {
  const [scheme, token] = (req.get('Authorization') || '').split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Login required' });
  }

  try {
    req.userId = verifyLoginToken(token);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired login token' });
  }
}

module.exports = requireAuth;
