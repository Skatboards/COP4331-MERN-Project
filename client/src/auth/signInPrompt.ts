import { createContext, useContext } from 'react';

// Why the sign-in dialog opened; changes its title and message
export type SignInReason = 'share' | 'archive' | 'leaderboard';

// Opens the sign-in dialog. `then` runs once the player has signed in,
// e.g. to open the share dialog they were reaching for.
export type OpenSignIn = (reason?: SignInReason, then?: () => void) => void;

export const SignInPromptContext = createContext<OpenSignIn>(() => {});

export function useSignInPrompt(): OpenSignIn {
  return useContext(SignInPromptContext);
}
