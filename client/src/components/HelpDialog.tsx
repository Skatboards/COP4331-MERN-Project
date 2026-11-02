import Modal from './Modal';

type HelpDialogProps = { onClose: () => void };

export default function HelpDialog({ onClose }: HelpDialogProps) {
  return (
    <Modal title="How to play" onClose={onClose} className="help-dialog">
      <p className="dialog-intro">Clear the board without finding a mine. Use the numbers to deduct the location of the mines.</p>
      <div className="howto-list">
        <div><span>01</span><p><strong>Reveal a tile</strong>Each number tells you how many mines touch that tile.</p></div>
        <div><span>02</span><p><strong>Mark the mines</strong>Flag the tiles you think are hiding a mine.</p></div>
        <div><span>03</span><p><strong>Clear the board</strong>Finish the daily puzzle in the shortest time possible.</p></div>
      </div>
      <a className="external-help-link" href="https://minesweeper.online/help/gameplay" target="_blank" rel="noreferrer">
        More detailed Minesweeper help <span aria-hidden="true">↗</span>
      </a>
      <button className="primary-button full-button" onClick={onClose}>Got it</button>
    </Modal>
  );
}
