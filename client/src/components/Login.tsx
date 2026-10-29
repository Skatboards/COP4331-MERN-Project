import { useState } from 'react';
import type { FormEvent } from 'react';

type User = {
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    email: string;
};

const TOKEN_KEY = 'token';
const USER_KEY = 'user';

// The verification email links back to /?verified=1 (or 0 if the link was bad)
function verifiedMessage(): string {
    const verified = new URLSearchParams(window.location.search).get('verified');
    if (verified === '1') return 'Email verified. You can now log in.';
    if (verified === '0') return 'That verification link is invalid or has expired.';
    return '';
}

function savedUser(): User | null {
    try {
        const saved = localStorage.getItem(USER_KEY);
        return saved && localStorage.getItem(TOKEN_KEY) ? JSON.parse(saved) : null;
    } catch {
        return null;
    }
}

async function postJson(path: string, body: object) {
    const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
}

export default function Login() {
    const [login, setLogin] = useState('');
    const [password, setPassword] = useState('');
    const [message, setMessage] = useState(verifiedMessage);
    const [unverifiedLogin, setUnverifiedLogin] = useState('');
    const [busy, setBusy] = useState(false);
    const [user, setUser] = useState<User | null>(savedUser);

    async function doLogin(event: FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        setUnverifiedLogin('');
        if (!login.trim() || !password) {
            setMessage('Enter your username or email and password.');
            return;
        }

        setBusy(true);
        setMessage('');
        try {
            const { status, data } = await postJson('/api/auth/login', { login, password });
            if (status === 200) {
                localStorage.setItem(TOKEN_KEY, data.token);
                localStorage.setItem(USER_KEY, JSON.stringify(data.user));
                setUser(data.user);
                setPassword('');
            } else {
                if (data.code === 'EMAIL_NOT_VERIFIED') {
                    setUnverifiedLogin(login);
                }
                setMessage(data.error || 'Login failed. Try again.');
            }
        } catch {
            setMessage('Could not reach the server. Try again.');
        } finally {
            setBusy(false);
        }
    }

    async function resendVerification(): Promise<void> {
        // The endpoint takes an email; a username can't be looked up here
        if (!unverifiedLogin.includes('@')) {
            setMessage('Log in with your email address to resend the verification email.');
            return;
        }
        setBusy(true);
        try {
            const { data } = await postJson('/api/auth/resend-verification', { email: unverifiedLogin });
            setMessage(data.message || 'Verification email sent.');
            setUnverifiedLogin('');
        } catch {
            setMessage('Could not reach the server. Try again.');
        } finally {
            setBusy(false);
        }
    }

    function doLogout(): void {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        setUser(null);
        setMessage('Logged out.');
    }

    if (user) {
        return(
            <div id="loginDiv">
                <span id="inner-title">LOGGED IN AS {user.username}</span><br />
                <span id="userName">{[user.firstName, user.lastName].filter(Boolean).join(' ')}</span><br />
                <input type="button" id="logoutButton" className="buttons" value="Log Out"
                    onClick={doLogout} />
            </div>
        );
    }

    return(
        <form id="loginDiv" onSubmit={doLogin}>
            <span id="inner-title">PLEASE LOG IN</span><br />
            <input type="text" id="loginName" placeholder="Username or email"
                autoComplete="username" value={login}
                onChange={(e) => setLogin(e.target.value)} /><br />
            <input type="password" id="loginPassword" placeholder="Password"
                autoComplete="current-password" value={password}
                onChange={(e) => setPassword(e.target.value)} /><br />
            <input type="submit" id="loginButton" className="buttons"
                value={busy ? 'Logging In...' : 'Do It'} disabled={busy} /><br />
            <span id="loginResult" role="status">{message}</span>
            {unverifiedLogin && (
                <>
                    <br />
                    <input type="button" id="resendButton" className="buttons"
                        value="Resend Verification Email" disabled={busy}
                        onClick={resendVerification} />
                </>
            )}
        </form>
    );
};
