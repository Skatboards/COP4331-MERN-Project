import type { Difficulty } from '../game/difficulty.ts';

type DifficultyBadgeProps = { difficulty: Difficulty; minClicks?: number };

// "Medium" plus, optionally, "Min. 61 clicks"
export default function DifficultyBadge({ difficulty, minClicks }: DifficultyBadgeProps) {
  return (
    <span className="badge-row">
      <span className={`badge difficulty-${difficulty.toLowerCase()}`}>{difficulty}</span>
      {minClicks !== undefined && (
        <span className="badge badge-quiet" title="The fewest clicks that can clear this board">Min. {minClicks} clicks</span>
      )}
    </span>
  );
}
