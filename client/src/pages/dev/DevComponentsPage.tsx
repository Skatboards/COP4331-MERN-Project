import { useState } from 'react';
import BoardPlaceholder from '../../components/BoardPlaceholder';
import Modal from '../../components/Modal';
import DifficultyBadge from '../../components/DifficultyBadge';
import StatTile from '../../components/StatTile';
import CompareBars from '../../components/CompareBars';
import BoardPreview from '../../components/BoardPreview';
import Icon from '../../components/Icon';

export default function DevComponentsPage() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <main className="subpage dev-reference-page">
      <header className="page-heading">
        <div><span className="eyebrow">DEVELOPER REFERENCE</span><h1>Components</h1>
          <p>Reusable interface pieces and common UI patterns.</p></div>
      </header>

      <section className="dev-reference-section" aria-labelledby="buttons-title">
        <h2 id="buttons-title">Buttons</h2>
        <div className="dev-component-sample">
          <button className="primary-button" type="button">Primary action</button>
          <button className="text-button" type="button">Text action</button>
          <button className="back-link" type="button">Back link</button>
          <button className="danger-button" type="button">Destructive action</button>
          <button className="text-button danger-text" type="button">Destructive text action</button>
        </div>
      </section>

      <section className="dev-reference-section" aria-labelledby="game-ui-title">
        <h2 id="game-ui-title">Game UI</h2>
        <div className="dev-component-sample">
          <DifficultyBadge difficulty="Easy" minClicks={41} />
          <DifficultyBadge difficulty="Medium" />
          <DifficultyBadge difficulty="Hard" />
          <button className="secondary-button icon-button" type="button"><Icon name="shuffle" />Secondary action</button>
          <button className="icon-only-button" type="button" aria-label="Next"><Icon name="chevronRight" /></button>
          <span className="solved-by">Solved by <strong>1,531</strong> players</span>
        </div>
        <div className="dev-component-sample">
          <div className="stat-grid" style={{ width: '100%' }}>
            <StatTile label="Best efficiency" value="96%" />
            <StatTile label="Efficiency rank" value="#2" hint="of 10" />
          </div>
          <div style={{ width: '100%' }}>
            <CompareBars rows={[{ label: 'Efficiency', you: 91, average: 69, max: 100, format: (v) => `${v}%` }]} />
          </div>
          <BoardPreview seed="daily-2026-11-12" />
        </div>
        <p className="dev-reference-note">Also: <code>GameView</code>, <code>ShareDialog</code>, <code>ArchiveCalendar</code>, <code>WeekStrip</code>, and <code>ScoreCard</code> with <code>seed</code> or <code>tabs</code>.</p>
      </section>

      <section className="dev-reference-section" aria-labelledby="roles-title">
        <h2 id="roles-title">Role badges</h2>
        <div className="dev-component-sample">
          <span className="role-badge role-user">User</span>
          <span className="role-badge role-admin">Admin</span>
          <span className="role-badge role-siteadmin">Site admin</span>
        </div>
      </section>

      <section className="dev-reference-section" aria-labelledby="cards-title">
        <h2 id="cards-title">Cards and board placeholder</h2>
        <div className="dev-card-samples">
          <article className="settings-card dev-sample-card"><strong>Settings card</strong><p>Use for grouped preferences and account options.</p></article>
          <article className="scores-card dev-sample-card"><div className="section-heading"><h2>Player leaderboard</h2><span className="trophy" aria-hidden="true">✦</span></div><p className="api-state">Leaderboard content sits inside the card.</p></article>
        </div>
        <div className="dev-board-sample"><BoardPlaceholder /></div>
      </section>

      <section className="dev-reference-section" aria-labelledby="dialog-title-sample">
        <h2 id="dialog-title-sample">Dialog</h2>
        <div className="dev-component-sample">
          <button className="primary-button" type="button" onClick={() => setModalOpen(true)}>Open sample dialog</button>
          <span className="dev-reference-note">Escape or click outside to close.</span>
        </div>
      </section>
      {modalOpen && <Modal title="Sample dialog" onClose={() => setModalOpen(false)}>
        <p className="dialog-intro">Dialogs use the shared overlay and surface styles. Keep the title descriptive and provide a clear way to close.</p>
        <button className="primary-button full-button" type="button" onClick={() => setModalOpen(false)}>Done</button>
      </Modal>}
    </main>
  );
}
