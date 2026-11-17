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

export type Attempt = {
  id: string;
  seed: string | null;
  clicks: number;
  completed: boolean;
  efficiency: number;
  completionPercentage: number;
  status: 'in_progress' | 'won' | 'lost';
  completedAt: string | null;
};

export type ArchiveStats = {
  gamesPlayed: number;
  gamesWon: number;
  winRate: number;
  averageEfficiency: number;
  totalClicks: number;
};

export type BoardAttempt = Pick<Attempt, 'clicks' | 'completed' | 'efficiency' | 'status' | 'completedAt'> & {
  username: string | null;
};
