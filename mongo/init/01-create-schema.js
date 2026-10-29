
const gameDb = db.getSiblingDB('GameDB');

// CREATE COLLECTIONS

if (!gameDb.getCollectionNames().includes('users')) {
  gameDb.createCollection('users');
}

if (!gameDb.getCollectionNames().includes('boards')) {
  gameDb.createCollection('boards');
}

if (!gameDb.getCollectionNames().includes('boardAttempts')) {
  gameDb.createCollection('boardAttempts');
}

// CREATE UNIQUE INDEXES

gameDb.users.createIndex(
  { username: 1 },
  { unique: true }
);

gameDb.users.createIndex(
  { email: 1 },
  { unique: true }
);

// One user per GitHub or Google account (users without linked accounts are skipped)
gameDb.users.createIndex(
  { 'oauthAccounts.provider': 1, 'oauthAccounts.providerId': 1 },
  { unique: true, partialFilterExpression: { oauthAccounts: { $exists: true } } }
);

gameDb.boards.createIndex(
  { seed: 1 },
  { unique: true }
);

gameDb.boardAttempts.createIndex(
  { userId: 1, boardId: 1 },
  { unique: true }
);

print('GameDB schema created.');
