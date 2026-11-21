// Lowest to highest; see backend/lib/roles.js
export type Role = 'user' | 'admin' | 'siteadmin';

export type CurrentUser = {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  emailVerified: boolean;
  // Missing from sessions saved before roles existed until /users/me refreshes them
  role?: Role;
  totalClicks: number;
  boardsCompleted: number;
  efficiency: number;
  // When the account was made; missed days are counted from here
  createdAt?: string;
};

// An account as the admin dashboard shows it (GET /api/admin/users)
export type AdminUser = CurrentUser & {
  role: Role;
  providers: string[];
  createdAt: string;
  hasPassword: boolean;
  // Whether the signed-in admin may edit, reset, or delete this account
  manageable: boolean;
};

export type AdminUserInput = {
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role?: Role;
  password?: string;
  emailVerified?: boolean;
};

export type Player = {
  _id: string;
  firstName: string;
  lastName: string;
  username: string;
  totalClicks: number;
  boardsCompleted: number;
  efficiency: number;
};

export type Board = {
  _id: string;
  seed: string;
  totalAttempts: number;
  totalCompletions: number;
  globalCompletionPercentage: number;
  averageClicks: number;
  averageEfficiency: number;
  createdAt: string;
};

// How a game was reached: today's board, a past day from the archive, or
// a random past day
export type PlayMode = 'daily' | 'archive' | 'random';

// The board as a finished game left it, for "Your final board"
export type FinalState = {
  revealed: number[];
  flags: number[];
  explodedAt: number | null;
};

export type Attempt = {
  id: string;
  seed: string | null;
  clicks: number;
  completed: boolean;
  efficiency: number;
  completionPercentage: number;
  status: 'in_progress' | 'won' | 'lost';
  completedAt: string | null;
  // Milliseconds; null for games recorded before the timer
  timeMs: number | null;
  // Played on the board's own day (only these count toward a streak)
  onTime: boolean;
  mode: PlayMode;
};

export type MyBoardAttempt = Attempt & { finalState: FinalState | null };

export type ArchiveStats = {
  gamesPlayed: number;
  gamesWon: number;
  winRate: number;
  averageEfficiency: number;
  totalClicks: number;
  bestEfficiency: number;
  currentStreak: number;
  longestStreak: number;
  // Place on the efficiency leaderboard, or null before a first win
  efficiencyRank: number | null;
  playersRanked: number;
};

export type BoardAttempt = Pick<Attempt, 'clicks' | 'completed' | 'efficiency' | 'status' | 'completedAt' | 'completionPercentage' | 'timeMs' | 'onTime'> & {
  username: string | null;
};

export type FinishedGame = {
  clicks: number;
  status: 'won' | 'lost';
  efficiency?: number;
  completionPercentage: number;
  timeMs?: number;
  mode?: PlayMode;
  finalState?: FinalState;
};

export type PlayedGame = {
  status: 'won' | 'lost';
  clicks: number;
  efficiency: number;
  completionPercentage: number;
  timeMs: number | null;
  finalState: FinalState | null;
};
