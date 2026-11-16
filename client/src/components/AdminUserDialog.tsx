import { useState } from 'react';
import type { FormEvent } from 'react';
import Modal from './Modal';
import { ApiError } from '../api/client';
import type { AdminUser, AdminUserInput, Role } from '../api/types';
import { ROLE_LABELS } from '../auth/roles';

type AdminUserDialogProps = {
  // The account being edited; leave out to create one
  user?: AdminUser;
  // Roles the signed-in admin may give (see auth/roles.ts)
  roles: Role[];
  onSave: (input: AdminUserInput) => Promise<void>;
  onClose: () => void;
};

function text(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

// Create or edit an account on the admin dashboard
export default function AdminUserDialog({ user, roles, onSave, onClose }: AdminUserDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const editing = Boolean(user);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const input: AdminUserInput = {
      username: text(form, 'username'),
      email: text(form, 'email'),
      firstName: text(form, 'firstName'),
      lastName: text(form, 'lastName'),
    };
    const role = text(form, 'role') as Role;
    if (role) input.role = role;
    if (editing) {
      input.emailVerified = form.get('emailVerified') === 'on';
    } else {
      const password = form.get('password');
      if (typeof password === 'string' && password) input.password = password;
    }

    setBusy(true);
    setError('');
    try {
      await onSave(input);
    } catch (saveError: unknown) {
      setError(saveError instanceof ApiError || saveError instanceof Error ? saveError.message : 'Could not save the account.');
      setBusy(false);
    }
  }

  return (
    <Modal title={editing ? `Edit ${user?.username}` : 'New user'} onClose={onClose} className="admin-user-dialog">
      {!editing && <p className="dialog-intro">The account starts verified. Leave the password empty to email the user a link to set one.</p>}
      <form className="sign-in-form" onSubmit={submit}>
        <label>Username<input name="username" required minLength={3} maxLength={20} pattern="[A-Za-z0-9_]+" defaultValue={user?.username} autoComplete="off" /></label>
        <label>Email<input name="email" required type="email" defaultValue={user?.email} autoComplete="off" /></label>
        <div className="form-row">
          <label>First name<input name="firstName" defaultValue={user?.firstName} autoComplete="off" /></label>
          <label>Last name<input name="lastName" defaultValue={user?.lastName} autoComplete="off" /></label>
        </div>
        {roles.length > 1 && (
          <label>Role
            <select name="role" defaultValue={user?.role ?? 'user'}>
              {roles.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}
            </select>
          </label>
        )}
        {editing ? (
          <label className="checkbox-label"><input name="emailVerified" type="checkbox" defaultChecked={user?.emailVerified} />Email verified</label>
        ) : (
          <label>Password (optional)<input name="password" type="password" minLength={8} autoComplete="new-password" /></label>
        )}
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button className="primary-button full-button" type="submit" disabled={busy}>
          {busy ? 'Saving…' : editing ? 'Save changes' : 'Create user'}
        </button>
      </form>
    </Modal>
  );
}
