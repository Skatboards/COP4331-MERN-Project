import { useState } from 'react';

export default function SettingsPage() {
  const [sound, setSound] = useState(true);
  const [contrast, setContrast] = useState(false);

  return (
    <main className="subpage settings-page">
      <div className="page-heading"><h1>Settings</h1></div>
      <section className="settings-card">
        <div className="settings-row">
          <div><strong>Sound effects</strong><p>Play a sound when you reveal a tile.</p></div>
          <button className={`toggle ${sound ? 'on' : ''}`} role="switch" aria-checked={sound} onClick={() => setSound(!sound)}><span /></button>
        </div>
        <div className="settings-row">
          <div><strong>High contrast</strong><p>Increase contrast on board tiles and text.</p></div>
          <button className={`toggle ${contrast ? 'on' : ''}`} role="switch" aria-checked={contrast} onClick={() => setContrast(!contrast)}><span /></button>
        </div>
      </section>
    </main>
  );
}
