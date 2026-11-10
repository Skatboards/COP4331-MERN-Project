const tokens = [
  ['--page-bg', 'Page background'], ['--surface', 'Surface'], ['--surface-alt', 'Alternate surface'],
  ['--surface-hover', 'Hover surface'], ['--surface-tint', 'Tinted surface'], ['--text', 'Main text'],
  ['--text-soft', 'Soft text'], ['--muted', 'Muted text'], ['--subtle', 'Subtle text'],
  ['--line', 'Border'], ['--line-strong', 'Strong border'], ['--brand', 'Brand'],
  ['--brand-soft', 'Brand soft'], ['--brand-text', 'Brand text'], ['--gold', 'Gold'],
  ['--grid-dot', 'Board grid dots'], ['--cell-bg', 'Covered cell'], ['--cell-border', 'Cell border'],
  ['--cell-shadow', 'Cell shadow'],
] as const;

export default function DevColorsPage() {
  return (
    <main className="subpage dev-reference-page">
      <header className="page-heading">
        <div><span className="eyebrow">DEVELOPER REFERENCE</span><h1>Color reference</h1>
          <p>Theme tokens are defined on <code>.app-shell</code> in <code>App.css</code>. Use the header theme control to preview them.</p></div>
      </header>
      <section className="dev-color-grid" aria-label="Theme color tokens">
        {tokens.map(([token, label]) => (
          <article className="dev-color-card" key={token}>
            <span className="dev-color-swatch" style={{ backgroundColor: `var(${token})` }} aria-label={`${label} color`} />
            <div><strong>{label}</strong><code>{token}</code></div>
          </article>
        ))}
      </section>
      <p className="dev-reference-note">Use these semantic tokens in component styles so colors follow the active theme and high contrast settings.</p>
    </main>
  );
}
