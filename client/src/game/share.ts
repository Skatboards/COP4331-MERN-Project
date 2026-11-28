import { formatDuration } from './dates.ts';

export type ShareInput = {
  dateLabel: string;
  status: 'won' | 'lost';
  completion: number;
  clicks: number;
  timeMs?: number | null;
  efficiency?: number | null;
  streak?: number | null;
  difficulty?: string | null;
  url: string;
};

// The text players copy after a game, e.g.
//   Sweeple · November 12, 2026 (Medium)
//   ✅ Solved · 100% cleared
//   ⏱ 3:42 · 🖱 61 clicks · 92% efficiency
//   🔥 5-day streak
//   https://…/archive/daily-2026-11-12
export function buildShareText(input: ShareInput): string {
  const title = `Sweeple · ${input.dateLabel}${input.difficulty ? ` (${input.difficulty})` : ''}`;
  const result = input.status === 'won'
    ? `✅ Solved · ${input.completion}% cleared`
    : `💥 Not solved · ${input.completion}% cleared`;
  const details = [
    input.timeMs !== null && input.timeMs !== undefined ? `⏱ ${formatDuration(input.timeMs)}` : null,
    `🖱 ${input.clicks} ${input.clicks === 1 ? 'click' : 'clicks'}`,
    input.status === 'won' && input.efficiency ? `${input.efficiency}% efficiency` : null,
  ].filter(Boolean).join(' · ');
  const lines = [title, result, details];
  if (input.streak && input.streak > 0) lines.push(`🔥 ${input.streak}-day streak`);
  lines.push(input.url);
  return lines.join('\n');
}

// The link in shared text: the archive page for that board
export function shareUrl(seed: string, origin: string): string {
  return `${origin}/archive/${encodeURIComponent(seed)}`;
}

// "1,531" players; a dash while the count is loading
export function solvedByLabel(stats: { totalCompletions: number } | null): string {
  return stats ? stats.totalCompletions.toLocaleString('en-US') : '–';
}
