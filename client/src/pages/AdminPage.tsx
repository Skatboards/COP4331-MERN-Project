import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createUser, deleteUser, listUsers, sendPasswordReset, updateUser } from '../api/admin';
import { ApiError } from '../api/client';
import type { AdminUser, AdminUserInput, Role } from '../api/types';
import { useAuth } from '../auth/useAuth';
import { assignableRoles, ROLE_LABELS } from '../auth/roles';
import AdminUserDialog from '../components/AdminUserDialog';
import ConfirmDialog from '../components/ConfirmDialog';

const PAGE_SIZE = 20;

type Tab = 'users' | 'admins';

const TAB_ROLES: Record<Tab, Role[]> = {
  users: ['user'],
  admins: ['admin', 'siteadmin'],
};

type Editing = { mode: 'create' } | { mode: 'edit'; user: AdminUser } | null;

function joinedDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function message(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

// /admin - Account management for admins (regular users) and site admins
// (users and admins). Only reachable through RequireRole; the server checks
// every action again.
export default function AdminPage() {
  const { token, user, logout } = useAuth();
  const navigate = useNavigate();
  const isSiteAdmin = user?.role === 'siteadmin';
  const roles = assignableRoles(user?.role);

  const [tab, setTab] = useState<Tab>('users');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reload, setReload] = useState(0);
  const [editing, setEditing] = useState<Editing>(null);
  const [deleting, setDeleting] = useState<AdminUser | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const refresh = useCallback(() => {
    setLoading(true);
    setError('');
    setReload((value) => value + 1);
  }, []);

  // A 401 means the session ended; a 403 means the account lost its role
  const handleAccessError = useCallback((requestError: unknown) => {
    if (requestError instanceof ApiError && requestError.status === 401) {
      logout();
      navigate('/', { replace: true });
      return true;
    }
    return false;
  }, [logout, navigate]);

  // Wait for typing to pause before searching
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (!token) return;
    let active = true;
    listUsers(token, { q: query, roles: TAB_ROLES[tab], page, limit: PAGE_SIZE })
      .then((result) => {
        if (!active) return;
        setUsers(result.users);
        setTotal(result.total);
        setError('');
      })
      .catch((requestError: unknown) => {
        if (!active || handleAccessError(requestError)) return;
        setError(message(requestError, 'Could not load accounts.'));
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token, tab, query, page, reload, handleAccessError]);

  function switchTab(next: Tab) {
    if (next === tab) return;
    setTab(next);
    setPage(1);
    setNotice('');
    setLoading(true);
  }

  async function save(input: AdminUserInput) {
    if (!token || !editing) return;
    if (editing.mode === 'create') {
      const { user: created } = await createUser(token, input);
      setNotice(input.password
        ? `Created ${created.username}.`
        : `Created ${created.username}. A link to set a password was emailed to ${created.email}.`);
    } else {
      // The edit form has no password field; resets go through email
      const { user: updated } = await updateUser(token, editing.user.id, input);
      setNotice(`Saved ${updated.username}.`);
    }
    setEditing(null);
    refresh();
  }

  async function resetPassword(target: AdminUser) {
    if (!token) return;
    setNotice('');
    try {
      const result = await sendPasswordReset(token, target.id);
      setNotice(result.message);
    } catch (requestError: unknown) {
      if (!handleAccessError(requestError)) setError(message(requestError, 'Could not send the reset email.'));
    }
  }

  async function confirmDelete() {
    if (!token || !deleting) return;
    setDeleteBusy(true);
    setDeleteError('');
    try {
      await deleteUser(token, deleting.id);
      setNotice(`Deleted ${deleting.username}.`);
      setDeleting(null);
      refresh();
    } catch (requestError: unknown) {
      if (!handleAccessError(requestError)) setDeleteError(message(requestError, 'Could not delete the account.'));
    } finally {
      setDeleteBusy(false);
    }
  }

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="subpage admin-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">{isSiteAdmin ? 'SITE ADMIN' : 'ADMIN'}</span>
          <h1>Dashboard</h1>
          <p>{isSiteAdmin ? 'Manage players and admins.' : 'Manage player accounts.'}</p>
        </div>
        <button className="primary-button admin-new" type="button" onClick={() => { setNotice(''); setEditing({ mode: 'create' }); }}>
          New user
        </button>
      </div>

      {isSiteAdmin && (
        <div className="admin-tabs" role="tablist" aria-label="Account type">
          <button role="tab" type="button" aria-selected={tab === 'users'} onClick={() => switchTab('users')}>Users</button>
          <button role="tab" type="button" aria-selected={tab === 'admins'} onClick={() => switchTab('admins')}>Admins</button>
        </div>
      )}

      <div className="admin-toolbar">
        <label className="admin-search">
          <span className="visually-hidden">Search accounts</span>
          <input
            type="search"
            placeholder="Search by username, name, or email"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <span className="admin-count">{total} {total === 1 ? 'ACCOUNT' : 'ACCOUNTS'}</span>
      </div>

      {notice && <p className="auth-notice admin-notice" role="status">{notice}</p>}

      {loading ? <p className="api-state" role="status">Loading accounts…</p>
        : error ? <div className="empty-state api-error-state" role="alert"><p>{error}</p><button className="text-button" onClick={refresh}>Try again</button></div>
          : users.length === 0 ? <p className="api-state">{query ? 'No accounts match that search.' : 'No accounts yet.'}</p>
            : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th scope="col">Username</th>
                      <th scope="col">Name</th>
                      <th scope="col">Email</th>
                      <th scope="col">Role</th>
                      <th scope="col">Verified</th>
                      <th scope="col">Boards</th>
                      <th scope="col">Joined</th>
                      <th scope="col"><span className="visually-hidden">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((account) => (
                      <tr key={account.id}>
                        <td className="admin-username">{account.username}{account.id === user?.id && <span className="admin-you"> (you)</span>}</td>
                        <td>{[account.firstName, account.lastName].filter(Boolean).join(' ') || '—'}</td>
                        <td>{account.email}</td>
                        <td><span className={`role-badge role-${account.role}`}>{ROLE_LABELS[account.role]}</span></td>
                        <td>{account.emailVerified ? 'Yes' : 'No'}</td>
                        <td>{account.boardsCompleted}</td>
                        <td>{joinedDate(account.createdAt)}</td>
                        <td className="admin-actions">
                          {account.manageable && (
                            <>
                              <button className="text-button" type="button" onClick={() => { setNotice(''); setEditing({ mode: 'edit', user: account }); }}>Edit</button>
                              <button className="text-button" type="button" onClick={() => resetPassword(account)}>Reset password</button>
                              <button className="text-button danger-text" type="button" onClick={() => { setDeleteError(''); setDeleting(account); }}>Delete</button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

      {pages > 1 && (
        <div className="admin-pager">
          <button className="text-button" type="button" disabled={page <= 1} onClick={() => { setLoading(true); setPage(page - 1); }}>← Previous</button>
          <span>Page {page} of {pages}</span>
          <button className="text-button" type="button" disabled={page >= pages} onClick={() => { setLoading(true); setPage(page + 1); }}>Next →</button>
        </div>
      )}

      {editing && (
        <AdminUserDialog
          user={editing.mode === 'edit' ? editing.user : undefined}
          roles={roles}
          onSave={save}
          onClose={() => setEditing(null)}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title={`Delete ${deleting.username}?`}
          confirmLabel="Delete account"
          busy={deleteBusy}
          error={deleteError}
          onConfirm={confirmDelete}
          onClose={() => setDeleting(null)}
        >
          This permanently deletes the account and all of its games, and the stats of the boards it played are recalculated. This cannot be undone.
        </ConfirmDialog>
      )}
    </main>
  );
}
