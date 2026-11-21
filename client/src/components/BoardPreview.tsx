import { useMemo, type CSSProperties } from 'react';
import { generateBoard, openingReveal } from '../game/minesweeper.ts';
import '../components/Minesweeper/Minesweeper.css';

type BoardPreviewProps = {
  seed: string;
  // Cells to show as open; defaults to the board's free starting opening
  revealed?: number[];
  className?: string;
};

// A small, decorative picture of a board, drawn with the game's tile styles
export default function BoardPreview({ seed, revealed, className = '' }: BoardPreviewProps) {
  const board = useMemo(() => generateBoard(seed), [seed]);
  const open = useMemo(() => new Set(revealed ?? openingReveal(board)), [board, revealed]);
  return (
    <span className={`ms-board board-preview ${className}`} style={{ '--ms-cols': board.cols } as CSSProperties} aria-hidden="true">
      {board.adjacent.map((count, index) => {
        const isOpen = open.has(index) && !board.isMine[index];
        return (
          <i key={index} className={`ms-cell ${isOpen ? `ms-open${count ? ` ms-n${count}` : ''}` : ''}`}>
            {isOpen && count ? count : ''}
          </i>
        );
      })}
    </span>
  );
}
