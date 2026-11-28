// Sets a user's role from the command line, e.g. to create or remove a site
// admin (the dashboard cannot grant or remove "siteadmin"):
//
//   npm run set-role -- <username or email> <user|admin|siteadmin>
//
// Uses MONGODB_URI from the environment or backend/.env. In Docker Compose:
//   docker compose -f compose.dev.yaml exec backend npm run set-role -- alexrivera siteadmin
require('dotenv').config();
const mongoose = require('mongoose');
const { User } = require('../models');
const { ROLES, isRole } = require('../lib/roles');

// Returns the updated user; throws when the role or user is not valid
async function setRole(login, role) {
  if (!isRole(role)) {
    throw new Error(`Role must be one of: ${ROLES.join(', ')}`);
  }
  const text = String(login || '').trim();
  if (!text) {
    throw new Error('A username or email is required');
  }
  const user = await User.findOneAndUpdate(
    text.includes('@') ? { email: text.toLowerCase() } : { username: text },
    { $set: { role } },
    { returnDocument: 'after' }
  );
  if (!user) {
    throw new Error(`No user with username or email "${text}"`);
  }
  return user;
}

async function main([login, role]) {
  if (!login || !role) {
    console.error('Usage: npm run set-role -- <username or email> <user|admin|siteadmin>');
    process.exitCode = 1;
    return;
  }
  await mongoose.connect(process.env.MONGODB_URI);
  try {
    const user = await setRole(login, role);
    console.log(`${user.username} <${user.email}> is now ${user.role}`);
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main(process.argv.slice(2));
}

module.exports = { setRole };
