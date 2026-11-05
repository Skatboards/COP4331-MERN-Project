import { useState } from 'react';
import type { FormEvent } from 'react';
import { postJson } from '../auth.ts';

type Props = {
    onMessage: (message: string) => void;
};

const EMPTY = { firstName: '', lastName: '', username: '', email: '', password: '' };

// Standard email and password sign-up; the API emails a verification link
export default function SignUp({ onMessage }: Props) {
    const [form, setForm] = useState(EMPTY);
    const [busy, setBusy] = useState(false);

    function update(field: keyof typeof EMPTY, value: string): void {
        setForm((current) => ({ ...current, [field]: value }));
    }

    async function doSignUp(event: FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        setBusy(true);
        onMessage('');
        try {
            const { status, data } = await postJson('/api/auth/register', form);
            if (status === 201) {
                setForm(EMPTY);
                onMessage(data.message || 'Account created. Check your email to verify it.');
            } else {
                onMessage(data.error || 'Sign up failed. Try again.');
            }
        } catch {
            onMessage('Could not reach the server. Try again.');
        } finally {
            setBusy(false);
        }
    }

    return(
        <form id="signUpForm" onSubmit={doSignUp}>
            <span id="inner-title">CREATE AN ACCOUNT</span><br />
            <input type="text" id="signUpFirstName" placeholder="First name"
                autoComplete="given-name" value={form.firstName}
                onChange={(e) => update('firstName', e.target.value)} /><br />
            <input type="text" id="signUpLastName" placeholder="Last name"
                autoComplete="family-name" value={form.lastName}
                onChange={(e) => update('lastName', e.target.value)} /><br />
            <input type="text" id="signUpUsername" placeholder="Username (3-20 letters, numbers, _)"
                autoComplete="username" value={form.username}
                onChange={(e) => update('username', e.target.value)} /><br />
            <input type="email" id="signUpEmail" placeholder="Email"
                autoComplete="email" value={form.email}
                onChange={(e) => update('email', e.target.value)} /><br />
            <input type="password" id="signUpPassword" placeholder="Password (8+ characters)"
                autoComplete="new-password" value={form.password}
                onChange={(e) => update('password', e.target.value)} /><br />
            <input type="submit" id="signUpButton" className="buttons"
                value={busy ? 'Creating...' : 'Sign Up'} disabled={busy} />
        </form>
    );
};
