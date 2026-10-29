import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import {
    clearLogin,
    fetchMe,
    fetchProviders,
    messageFromUrl,
    postJson,
    saveLogin,
    savedUser,
    takeTokenFromUrl
} from '../auth.ts';
import type { Provider, User } from '../auth.ts';
import SignUp from './SignUp.tsx';

export default function Login() {
    const [mode, setMode] = useState<'login' | 'signup'>('login');
    const [providers, setProviders] = useState<Provider[]>([]);
    const [login, setLogin] = useState('');
    const [password, setPassword] = useState('');
    const [message, setMessage] = useState(messageFromUrl);
    const [unverifiedLogin, setUnverifiedLogin] = useState('');
    const [busy, setBusy] = useState(false);
    const [user, setUser] = useState<User | null>(savedUser);

    useEffect(() => {
        fetchProviders().then(setProviders);

        // Coming back from GitHub or Google
        const token = takeTokenFromUrl();
        if (token) {
            fetchMe(token)
                .then((me) => {
                    if (me) {
                        saveLogin(token, me);
                        setUser(me);
                    } else {
                        setMessage('Sign-in failed. Try again.');
                    }
                })
                .catch(() => setMessage('Could not reach the server. Try again.'));
        }
    }, []);

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
                saveLogin(data.token, data.user);
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
        clearLogin();
        setUser(null);
        setMessage('Logged out.');
    }

    function switchMode(next: 'login' | 'signup'): void {
        setMode(next);
        setMessage('');
        setUnverifiedLogin('');
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

    const oauthProviders = providers.filter((p) => p.id !== 'password');

    return(
        <div id="loginDiv">
            <div id="authTabs" role="tablist">
                <button type="button" role="tab" aria-selected={mode === 'login'}
                    className={mode === 'login' ? 'tab active' : 'tab'}
                    onClick={() => switchMode('login')}>Log In</button>
                <button type="button" role="tab" aria-selected={mode === 'signup'}
                    className={mode === 'signup' ? 'tab active' : 'tab'}
                    onClick={() => switchMode('signup')}>Sign Up</button>
            </div>

            {oauthProviders.length > 0 && (
                <>
                    <div id="providerButtons">
                        {oauthProviders.map((p) => (
                            // A plain link: the server redirects to the provider
                            <a key={p.id} id={`${p.id}Button`} className="buttons provider"
                                href={`/api/auth/${p.id}`}>
                                Continue with {p.name}
                            </a>
                        ))}
                    </div>
                    <span className="divider">or with email</span>
                </>
            )}

            {mode === 'signup' ? (
                <SignUp onMessage={setMessage} />
            ) : (
                <form id="loginForm" onSubmit={doLogin}>
                    <span id="inner-title">PLEASE LOG IN</span><br />
                    <input type="text" id="loginName" placeholder="Username or email"
                        autoComplete="username" value={login}
                        onChange={(e) => setLogin(e.target.value)} /><br />
                    <input type="password" id="loginPassword" placeholder="Password"
                        autoComplete="current-password" value={password}
                        onChange={(e) => setPassword(e.target.value)} /><br />
                    <input type="submit" id="loginButton" className="buttons"
                        value={busy ? 'Logging In...' : 'Do It'} disabled={busy} />
                </form>
            )}

            <span id="loginResult" role="status">{message}</span>
            {unverifiedLogin && (
                <>
                    <br />
                    <input type="button" id="resendButton" className="buttons"
                        value="Resend Verification Email" disabled={busy}
                        onClick={resendVerification} />
                </>
            )}
        </div>
    );
};
