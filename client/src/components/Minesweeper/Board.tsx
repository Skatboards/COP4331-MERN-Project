import { useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import type { Board as BoardData } from '../../game/minesweeper.ts';
import type { GameState } from '../../game/state.ts';
import Cell from './Cell.tsx';
import './Minesweeper.css';

interface BoardProps {
  board: BoardData;
  game: GameState;
  flagMode: boolean;
  onReveal: (index: number) => void;
  onFlag: (index: number) => void;
}

export default function Board({ board, game, flagMode, onReveal, onFlag }: BoardProps) {
  const { rows, cols } = board;
  const finished = game.status !== 'playing';
  const won = game.status === 'won';
  const revealed = useMemo(() => new Set(game.revealed), [game.revealed]);
  const flags = useMemo(() => new Set(game.flags), [game.flags]);

  const [focusIndex, setFocusIndex] = useState(0);
  const boardRef = useRef<HTMLDivElement>(null);

  const focusCell = (i: number) => {
    setFocusIndex(i);
    boardRef.current?.querySelector<HTMLButtonElement>(`[data-index="${i}"]`)?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, [number, number]> = {
      ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1],
    };
    if (e.key in moves) {
      e.preventDefault();
      const [dr, dc] = moves[e.key];
      const r = Math.min(rows - 1, Math.max(0, Math.floor(focusIndex / cols) + dr));
      const c = Math.min(cols - 1, Math.max(0, (focusIndex % cols) + dc));
      focusCell(r * cols + c);
    } else if (e.key === 'f' || e.key === 'F') {
      e.preventDefault();
      onFlag(focusIndex);
    }
  };

  const activate = (i: number) => (flagMode ? onFlag(i) : onReveal(i));

  const cells = [];
  for (let i = 0; i < rows * cols; i++) {
    const isMine = board.isMine[i];
    cells.push(
      <Cell
        key={i}
        index={i}
        row={Math.floor(i / cols)}
        col={i % cols}
        revealed={revealed.has(i)}
        adjacent={board.adjacent[i]}
        flagged={flags.has(i)}
        showMine={finished && isMine && !revealed.has(i)}
        exploded={game.explodedAt === i}
        won={won}
        wrongFlag={finished && flags.has(i) && !isMine}
        finished={finished}
        focusable={i === focusIndex}
        onActivate={activate}
        onFlag={onFlag}
        onFocusCell={setFocusIndex}
      />
    );
  }

  return (
    <div
      ref={boardRef}
      className="ms-board"
      role="group"
      aria-label="Minesweeper board. Arrow keys move, Enter reveals, F flags."
      style={{ '--ms-cols': cols } as CSSProperties}
      onKeyDown={onKeyDown}
    >
      {cells}
    </div>
  );
}