import { useEffect, useMemo, useState } from 'react';
import Modal from './Modal';
import Icon from './Icon';
import { getMyAttempts } from '../api/users';
import { useAuth } from '../auth/useAuth';
import { buildShareText, shareUrl, type ShareInput } from '../game/share.ts';

type ShareDialogProps = {
  seed: string;
  result: Omit<ShareInput, 'url' | 'streak'>;
  onClose: () => void;
};

// Shows the result as text to copy, plus the phone share sheet where offered
export default function ShareDialog({ seed, result, onClose }: ShareDialogProps) {
  const { token } = useAuth();
  const [streak, setStreak] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');

  useEffect(() => {
    if (!token) return;
    let active = true;
    getMyAttempts(token, { limit: 1 })
      .then(({ stats }) => { if (active) setStreak(stats.currentStreak); })
      .catch(() => { /* The text works without a streak */ });
    return () => { active = false; };
  }, [token]);

  const url = shareUrl(seed, window.location.origin);
  const text = useMemo(() => buildShareText({ ...result, streak, url }), [result, streak, url]);
  const canShare = typeof navigator.share === 'function';

  async function copy() {
    setCopyError('');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyError('Copying was blocked. Select the text and copy it yourself.');
    }
  }

  return (
    <Modal title="Share your result" onClose={onClose} className="share-dialog">
      <p className="dialog-intro">Copy this into a chat or post. The link opens the same board.</p>
      <textarea className="share-text" readOnly value={text} rows={text.split('\n').length} aria-label="Share text" onFocus={(event) => event.currentTarget.select()} />
      {copyError && <p className="auth-error" role="alert">{copyError}</p>}
      <div className="dialog-actions">
        {canShare && (
          <button className="text-button" type="button" onClick={() => { navigator.share({ text }).catch(() => {}); }}>
            More options
          </button>
        )}
        <button className="primary-button icon-button" type="button" onClick={copy}>
          <Icon name={copied ? 'check' : 'copy'} />
          <span>{copied ? 'Copied' : 'Copy text'}</span>
        </button>
      </div>
    </Modal>
  );
}
