import type { ReactNode } from 'react';

type StatTileProps = { label: string; value: ReactNode; hint?: string };

export default function StatTile({ label, value, hint }: StatTileProps) {
  return (
    <div className="stat-tile">
      <span>{label}</span>
      <strong>{value}</strong>
      {hint && <small>{hint}</small>}
    </div>
  );
}
