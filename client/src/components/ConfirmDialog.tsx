import type { ReactNode } from 'react';
import Modal from './Modal';

type ConfirmDialogProps = {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  busy?: boolean;
  error?: string;
  onConfirm: () => void;
  onClose: () => void;
};

// Asks before a destructive action, such as deleting an account
export default function ConfirmDialog({ title, children, confirmLabel, busy = false, error, onConfirm, onClose }: ConfirmDialogProps) {
  return (
    <Modal title={title} onClose={onClose}>
      <div className="dialog-intro">{children}</div>
      {error && <p className="auth-error confirm-error" role="alert">{error}</p>}
      <div className="dialog-actions">
        <button className="text-button" type="button" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="danger-button" type="button" onClick={onConfirm} disabled={busy}>
          {busy ? 'Working…' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
