import type { FormEvent } from 'react';
import Modal from './Modal';

type SignInDialogProps = {
  onClose: () => void;
  onSignIn: (event: FormEvent<HTMLFormElement>) => void;
};

export default function SignInDialog({ onClose, onSignIn }: SignInDialogProps) {
  return (
    <Modal title="Welcome back" onClose={onClose} className="sign-in-dialog">
      <p className="dialog-intro">Sign in to keep your Sweeple streak going.</p>
      <form className="sign-in-form" onSubmit={onSignIn}>
        <label>Email or username<input name="username" required autoComplete="username" placeholder="Your username" /></label>
        <label>Password<input name="password" required type="password" autoComplete="current-password" placeholder="Your password" /></label>
        <button className="primary-button full-button" type="submit">Sign in</button>
      </form>
      <p className="demo-note">Preview mode: any username and password will continue.</p>
    </Modal>
  );
}
