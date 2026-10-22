
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

// SAMPLE USERS

const users = [
  {
    firstName: 'Alex',
    lastName: 'Rivera',
    username: 'alexrivera',
    email: 'alex@example.com',
    passwordHash: 'DEMO_HASH_NOT_FOR_LOGIN',
    totalClicks: 120,
    boardsCompleted: 6,
    efficiency: 85.5
  },
  {
    firstName: 'Jamie',
    lastName: 'Chen',
    username: 'jamiechen',
    email: 'jamie@example.com',
    passwordHash: 'DEMO_HASH_NOT_FOR_LOGIN',
    totalClicks: 95,
    boardsCompleted: 5,
    efficiency: 91.2
  },
  {
    firstName: 'Taylor',
    lastName: 'Morgan',
    username: 'taylormorgan',
    email: 'taylor@example.com',
    passwordHash: 'DEMO_HASH_NOT_FOR_LOGIN',
    totalClicks: 180,
    boardsCompleted: 7,
    efficiency: 72.8
  },
  {
    firstName: 'Sam',
    lastName: 'Patel',
    username: 'sampatel',
    email: 'sam@example.com',
    passwordHash: 'DEMO_HASH_NOT_FOR_LOGIN',
    totalClicks: 145,
    boardsCompleted: 6,
    efficiency: 80.4
  },
  {
    firstName: 'Casey',
    lastName: 'Brooks',
    username: 'caseybrooks',
    email: 'casey@example.com',
    passwordHash: 'DEMO_HASH_NOT_FOR_LOGIN',
    totalClicks: 65,
    boardsCompleted: 3,
    efficiency: 88.6
  }
];

users.forEach(user => {
  if (!gameDb.users.findOne({ username: user.username })) {
    const now = new Date();

    gameDb.users.insertOne({
      ...user,
      createdAt: now,
      updatedAt: now
    });
  }
});

// SAMPLE BOARDS

const boards = [
  {
    seed: 'daily-2026-10-15',
    totalAttempts: 100,
    totalCompletions: 75,
    globalCompletionPercentage: 75,
    averageClicks: 18.4,
    averageEfficiency: 81.2
  },
  {
    seed: 'daily-2026-10-16',
    totalAttempts: 120,
    totalCompletions: 90,
    globalCompletionPercentage: 75,
    averageClicks: 20.1,
    averageEfficiency: 78.5
  },
  {
    seed: 'daily-2026-10-17',
    totalAttempts: 95,
    totalCompletions: 80,
    globalCompletionPercentage: 84.21,
    averageClicks: 15.8,
    averageEfficiency: 89.1
  },
  {
    seed: 'daily-2026-10-18',
    totalAttempts: 150,
    totalCompletions: 105,
    globalCompletionPercentage: 70,
    averageClicks: 22.6,
    averageEfficiency: 74.3
  },
  {
    seed: 'daily-2026-10-19',
    totalAttempts: 110,
    totalCompletions: 99,
    globalCompletionPercentage: 90,
    averageClicks: 14.2,
    averageEfficiency: 92.4
  },
  {
    seed: 'daily-2026-10-20',
    totalAttempts: 130,
    totalCompletions: 104,
    globalCompletionPercentage: 80,
    averageClicks: 19.7,
    averageEfficiency: 83.6
  },
  {
    seed: 'daily-2026-10-21',
    totalAttempts: 200,
    totalCompletions: 150,
    globalCompletionPercentage: 75,
    averageClicks: 21.3,
    averageEfficiency: 79.8
  },
  {
    seed: 'daily-2026-10-22',
    totalAttempts: 0,
    totalCompletions: 0,
    globalCompletionPercentage: 0,
    averageClicks: 0,
    averageEfficiency: 0
  }
];

boards.forEach(board => {
  if (!gameDb.boards.findOne({ seed: board.seed })) {
    const boardDate = new Date(
      board.seed.replace('daily-', '') + 'T00:00:00Z'
    );

    gameDb.boards.insertOne({
      ...board,
      createdAt: boardDate,
      updatedAt: boardDate
    });
  }
});

 // SAMPLE BOARD ATTEMPTS


const sampleAttempts = [
  {
    username: 'alexrivera',
    seed: 'daily-2026-10-20',
    clicks: 18,
    completed: true,
    efficiency: 85.5,
    status: 'won'
  },
  {
    username: 'jamiechen',
    seed: 'daily-2026-10-20',
    clicks: 15,
    completed: true,
    efficiency: 91.2,
    status: 'won'
  },
  {
    username: 'taylormorgan',
    seed: 'daily-2026-10-20',
    clicks: 26,
    completed: false,
    efficiency: 0,
    status: 'lost'
  },
  {
    username: 'alexrivera',
    seed: 'daily-2026-10-21',
    clicks: 20,
    completed: true,
    efficiency: 82.5,
    status: 'won'
  }
];

sampleAttempts.forEach(attempt => {
  const user = gameDb.users.findOne({
    username: attempt.username
  });

  const board = gameDb.boards.findOne({
    seed: attempt.seed
  });

  if (!user || !board) {
    print(`Skipping attempt for ${attempt.username} on ${attempt.seed}`);
    return;
  }

  const existingAttempt = gameDb.boardAttempts.findOne({
    userId: user._id,
    boardId: board._id
  });

  if (!existingAttempt) {
    const now = new Date();

    gameDb.boardAttempts.insertOne({
      userId: user._id,
      boardId: board._id,
      clicks: attempt.clicks,
      completed: attempt.completed,
      efficiency: attempt.efficiency,
      status: attempt.status,
      completedAt: attempt.status === 'in_progress' ? null : now,
      createdAt: now,
      updatedAt: now
    });
  }
});


print('GameDB initialization completed.');
print('Users: ' + gameDb.users.countDocuments({}));
print('Boards: ' + gameDb.boards.countDocuments({}));
print('Board Attempts: ' + gameDb.boardAttempts.countDocuments({}));
