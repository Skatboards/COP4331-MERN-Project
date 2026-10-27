
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

gameDb.boards.createIndex(
  { seed: 1 },
  { unique: true }
);

gameDb.boardAttempts.createIndex(
  { userId: 1, boardId: 1 },
  { unique: true }
);

print('GameDB schema created.');
