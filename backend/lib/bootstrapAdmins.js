// Site admins named in the SITE_ADMIN_EMAILS env var, a comma-separated list
// of email addresses. This is how the first site admin is created, since no
// one can promote anyone before a site admin exists.
//
// Matching accounts are promoted when the server starts (promoteSiteAdmins)
// and when a matching account is created later (roleForEmail). Removing an
// address from the list does not demote the account; use scripts/set-role.js.
const { User } = require('../models');

function siteAdminEmails() {
  return (process.env.SITE_ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

// The role a newly created account with this email should get
function roleForEmail(email) {
  return siteAdminEmails().includes(String(email).toLowerCase()) ? 'siteadmin' : 'user';
}

// Promotes the listed accounts that have a verified email; returns how many
// accounts changed. Unverified accounts are skipped so that registering with
// someone else's address (without being able to verify it) grants nothing.
async function promoteSiteAdmins() {
  const emails = siteAdminEmails();
  if (emails.length === 0) return 0;
  const result = await User.updateMany(
    { email: { $in: emails }, emailVerified: true, role: { $ne: 'siteadmin' } },
    { $set: { role: 'siteadmin' } }
  );
  return result.modifiedCount;
}

module.exports = { siteAdminEmails, roleForEmail, promoteSiteAdmins };
