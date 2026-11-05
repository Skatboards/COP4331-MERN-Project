// Login state shared by the sign-in components

export type User = {
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    email: string;
    providers?: string[];
};

export type Provider = { id: string; name: string };

const TOKEN_KEY = 'token';
const USER_KEY = 'user';

// Storage can be blocked (private windows, site-data settings); the app
// still works for the current page then, it just forgets on reload
export function savedUser(): User | null {
    try {
        const saved = localStorage.getItem(USER_KEY);
        return saved && localStorage.getItem(TOKEN_KEY) ? JSON.parse(saved) : null;
    } catch {
        return null;
    }
}

export function saveLogin(token: string, user: User): void {
    try {
        localStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch {
        // See savedUser
    }
}

export function clearLogin(): void {
    try {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
    } catch {
        // See savedUser
    }
}

export async function postJson(path: string, body: object) {
    const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
}

// The ways to sign in that the server has turned on
export async function fetchProviders(): Promise<Provider[]> {
    try {
        const res = await fetch('/api/auth/providers');
        const data = await res.json();
        return data.providers || [];
    } catch {
        return [{ id: 'password', name: 'Email and password' }];
    }
}

// After GitHub or Google, the server sends the browser to /#token=...
// Returns the token once and removes it from the address bar.
export function takeTokenFromUrl(): string | null {
    const match = window.location.hash.match(/^#token=([^&]+)$/);
    if (!match) return null;
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    return decodeURIComponent(match[1]);
}

export async function fetchMe(token: string): Promise<User | null> {
    const res = await fetch('/api/users/me', { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    const data = await res.json();
    return data.user;
}

const OAUTH_ERRORS: Record<string, string> = {
    cancelled: 'Sign-in was cancelled.',
    state: 'That sign-in link expired. Try again.',
    provider: 'Could not reach the sign-in provider. Try again.',
    email: 'That account has no verified email address, so it cannot be used to sign in.'
};

// Messages for the ?verified= and ?oauthError= the server redirects back with
export function messageFromUrl(): string {
    const params = new URLSearchParams(window.location.search);
    const verified = params.get('verified');
    if (verified === '1') return 'Email verified. You can now log in.';
    if (verified === '0') return 'That verification link is invalid or has expired.';
    const oauthError = params.get('oauthError');
    if (oauthError) return OAUTH_ERRORS[oauthError] || 'Sign-in failed. Try again.';
    return '';
}
