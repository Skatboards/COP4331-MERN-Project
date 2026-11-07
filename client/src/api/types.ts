export type CurrentUser = {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  emailVerified: boolean;
  totalClicks: number;
  boardsCompleted: number;
  efficiency: number;
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

export type BoardAttempt = Pick<Attempt, 'clicks' | 'completed' | 'efficiency' | 'status' | 'completedAt'> & {
  username: string | null;
};
