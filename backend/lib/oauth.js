const crypto = require('crypto');

// Sign-in providers. Each one is turned on by setting its client ID and
// secret; everything else about the flow is shared (see routes/oauth.js).
const PROVIDERS = {
  github: {
    name: 'GitHub',
    envPrefix: 'GITHUB',
    authorizeUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    scope: 'read:user user:email',
    getProfile: getGithubProfile
  },
  google: {
    name: 'Google',
    envPrefix: 'GOOGLE',
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scope: 'openid email profile',
    getProfile: getGoogleProfile
  }
};

// Read at call time so tests (and a restart with a new .env) can change them
function credentials(id) {
  const prefix = PROVIDERS[id].envPrefix;
  return {
    clientId: process.env[`${prefix}_CLIENT_ID`] || '',
    clientSecret: process.env[`${prefix}_CLIENT_SECRET`] || ''
  };
}

function isEnabled(id) {
  if (!Object.hasOwn(PROVIDERS, id)) {
    return false;
  }
  const { clientId, clientSecret } = credentials(id);
  return Boolean(clientId && clientSecret);
}

function enabledProviders() {
  return Object.keys(PROVIDERS).filter(isEnabled);
}

function base64url(buffer) {
  return buffer.toString('base64url');
}

// A random state (checked on the way back, against CSRF) and a PKCE verifier
// (proves the code exchange comes from whoever started the login)
function createLoginAttempt() {
  const state = base64url(crypto.randomBytes(24));
  const verifier = base64url(crypto.randomBytes(32));
  const challenge = base64url(crypto.createHash('sha256').update(verifier).digest());
  return { state, verifier, challenge };
}

function authorizeUrl(id, { state, challenge, redirectUri }) {
  const url = new URL(PROVIDERS[id].authorizeUrl);
  url.search = new URLSearchParams({
    client_id: credentials(id).clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: PROVIDERS[id].scope,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256'
  }).toString();
  return url.toString();
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { Accept: 'application/json', 'User-Agent': 'Sweeple', ...options.headers }
  });
  if (!res.ok) {
    throw new Error(`${options.method || 'GET'} ${url} failed with ${res.status}`);
  }
  return res.json();
}

// Swaps the code from the redirect for the provider's access token
async function exchangeCode(id, { code, verifier, redirectUri }) {
  const { clientId, clientSecret } = credentials(id);
  const data = await fetchJson(PROVIDERS[id].tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      code_verifier: verifier,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    }).toString()
  });
  if (!data.access_token) {
    throw new Error(`No access token from ${id}: ${data.error || 'unknown error'}`);
  }
  return data.access_token;
}

// Every provider's profile comes back in this shape
async function getProfile(id, accessToken) {
  return PROVIDERS[id].getProfile(accessToken);
}

async function getGithubProfile(accessToken) {
  const headers = { Authorization: `Bearer ${accessToken}`, Accept: 'application/vnd.github+json' };
  const user = await fetchJson('https://api.github.com/user', { headers });
  const emails = await fetchJson('https://api.github.com/user/emails', { headers });
  const primary = emails.find((e) => e.primary) || emails.find((e) => e.verified) || {};
  const [firstName = '', ...rest] = (user.name || '').trim().split(/\s+/);

  return {
    providerId: String(user.id),
    email: (primary.email || '').toLowerCase(),
    emailVerified: primary.verified === true,
    firstName,
    lastName: rest.join(' '),
    suggestedUsername: user.login || ''
  };
}

async function getGoogleProfile(accessToken) {
  const info = await fetchJson('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  return {
    providerId: String(info.sub),
    email: (info.email || '').toLowerCase(),
    emailVerified: info.email_verified === true,
    firstName: info.given_name || '',
    lastName: info.family_name || '',
    suggestedUsername: (info.email || '').split('@')[0]
  };
}

module.exports = {
  PROVIDERS,
  isEnabled,
  enabledProviders,
  createLoginAttempt,
  authorizeUrl,
  exchangeCode,
  getProfile
};
