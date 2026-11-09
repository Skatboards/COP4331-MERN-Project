import { useState } from 'react';
import { useAuth } from '../auth/useAuth';

type SettingsPageProps = { onSignIn: () => void; highContrast: boolean; onHighContrastChange: (enabled: boolean) => void };

function readSoundSetting() {
  try { return localStorage.getItem('sweeple-sound') !== 'false'; } catch { return true; }
}

export default function SettingsPage({ onSignIn, highContrast, onHighContrastChange }: SettingsPageProps) {
  const { user } = useAuth();
  const [sound, setSound] = useState(readSoundSetting);

  function updateSound(enabled: boolean) {
    setSound(enabled);
    try { localStorage.setItem('sweeple-sound', String(enabled)); } catch { /* Keep the preference for this session. */ }
  }

  return (
    <main className="subpage settings-page">
      <div className="page-heading"><h1>Settings</h1></div>
      <section className="settings-card">
        <div className="settings-row">
          <div><strong>Sound effects</strong><p>Play a sound when you reveal a tile.</p></div>
          <button type="button" className={`toggle ${sound ? 'on' : ''}`} role="switch" aria-label="Sound effects" aria-checked={sound} onClick={() => updateSound(!sound)}><span /></button>
        </div>
        <div className="settings-row">
          <div><strong>High contrast</strong><p>Increase contrast on board tiles and text.</p></div>
          <button type="button" className={`toggle ${highContrast ? 'on' : ''}`} role="switch" aria-label="High contrast" aria-checked={highContrast} onClick={() => {
            const next = !highContrast;
            onHighContrastChange(next);
            try { localStorage.setItem('sweeple-high-contrast', String(next)); } catch { /* Keep the preference for this session. */ }
          }}><span /></button>
        </div>
      </section>
      <section className="settings-card account-details">
        <h2>Account</h2>
        {user ? <>
          <div className="account-detail-row"><span>Username</span><strong>{user.username}</strong></div>
          <div className="account-detail-row"><span>Email</span><strong>{user.email}</strong></div>
          <div className="account-stats">
            <div><strong>{user.boardsCompleted}</strong><span>Boards completed</span></div>
            <div><strong>{user.totalClicks}</strong><span>Total clicks</span></div>
            <div><strong>{user.efficiency}%</strong><span>Efficiency</span></div>
          </div>
        </> : <div className="account-detail-row"><span>Sign in to view your profile stats.</span><button className="text-button" onClick={onSignIn}>Sign in</button></div>}
      </section>
    </main>
  );
}
