# Bruno collection

API requests for the MERN Project API Role lab, local auth testing, and game/stats smoke checks, for [Bruno](https://www.usebruno.com/).

## Auth requests

| # | Request | Expected |
| --- | --- | --- |
| 1 | Register | `201` — new `demo########` user; saves `lastRegisteredUsername` / `lastRegisteredEmail` |
| 2 | Register - Duplicate | `409` — run after Register |
| 3 | Get Auth Providers | `200` — includes `password`; GitHub/Google if configured on the server |
| 4 | Verify Email | `200` — needs secret `verifyToken` from the verification email (backend logs locally) |
| 5 | Resend Verification | `200` — body uses env `email` |
| 6 | Login | `200` — verified account; saves `token` |
| 7 | Login - Wrong Password | `401` |
| 8 | Login - Unverified | `403` `EMAIL_NOT_VERIFIED` — run Register, skip Verify Email |
| 9 | Forgot Password | `200` — env `email`; reset link in logs if SMTP is off |
| 10 | Reset Password | `200` — secrets `resetToken` + env `newPassword` |
| 11 | Get My Profile | `200` — Bearer token from Login |

OAuth browser redirects (`GET /api/auth/github`, callbacks) are not in this collection; use the app or `backend/tests/oauth.test.js`.

## Board requests

| # | Request | Auth | Expected |
| --- | --- | --- | --- |
| 12 | List Boards | No | `200` — saves first `seed` when the list is non-empty |
| 13 | Get Board | No | `200` — uses env `seed` |
| 14 | Board Attempts | No | `200` — best games on `seed`; `404` if the board does not exist |
| 15 | Record Attempt | Bearer | `201` — new `recordSeed` each run; run Login first |

## User requests (beyond profile)

| # | Request | Auth | Expected |
| --- | --- | --- | --- |
| 16 | My Attempts | Bearer | `200` — logged-in user's games |
| 17 | Leaderboard | No | `200` — env `leaderboardSort` |
| 18 | Search Users | No | `200` — env `searchQuery` |

## Admin requests (`Admin/` folder)

These need an admin or site admin account (see [docs/admin.md](../docs/admin.md)). Set `adminLogin` and the secret `adminPassword`. While `adminLogin` is empty, every request in the folder is skipped, so a full run with a regular account still passes.

| # | Request | Auth | Expected |
| --- | --- | --- | --- |
| 1 | Admin Login | No | `200`, role `admin` or `siteadmin`; saves `adminToken` |
| 2 | List Users | Bearer (admin) | `200` with `users` and `total` |
| 3 | Create User | Bearer (admin) | `201`: a new verified `bru########` user with no password; saves `adminUserId` |
| 4 | Update User | Bearer (admin) | `200`; only `firstName` changes |
| 5 | Send Password Reset | Bearer (admin) | `200`; the link is in the backend log when SMTP is off |
| 6 | Delete User | Bearer (admin) | `200`; removes the account from step 3 |

Run the folder on its own from the command line:

```bash
npx @usebruno/cli@4.3.0 run Admin --env Local \
  --env-var adminLogin=ADMIN_USERNAME \
  --env-var adminPassword=ADMIN_PASSWORD
```

## Environment variables

| Variable | Used for |
| --- | --- |
| `baseUrl` | Local or Production API base (through the client proxy or HTTPS site) |
| `login`, `password` (secret) | Login and wrong-password requests |
| `email` | Resend verification, forgot password |
| `newPassword` | Reset password |
| `verifyToken`, `resetToken` (secrets) | Verify email, reset password |
| `seed` | Get Board, Board Attempts; updated by List Boards or Record Attempt |
| `leaderboardSort` | `boardsCompleted`, `efficiency`, or `totalClicks` |
| `searchQuery` | Search Users |
| `adminLogin`, `adminPassword` (secret) | Admin folder; leave `adminLogin` empty to skip it |

Default `seed` in the environment files matches a board from Mongo seed data (`daily-2026-10-20`). Today's playable seed in the client is `daily-YYYY-MM-DD` for the current date.

## Setup

### VS Code / Cursor (Bruno extension)

1. Install the **[Bruno](https://marketplace.visualstudio.com/items?itemName=bruno-api-client.bruno)** extension (`bruno-api-client.bruno`).
2. **Open Collection** → choose this repo's `bruno/` folder (the one that contains `bruno.json`).
3. In the collection sidebar, open **Environments** → select **Local** (not Production) while Docker Compose is running on your machine.
4. Edit **Local**: set `login`, `email`, `seed`, and so on; mark `password`, `verifyToken`, and `resetToken` as **secret** in the environment UI (they match `vars:secret` in `environments/Local.bru`).
5. Start the stack from the repo root: `docker compose up -d` (API via `http://localhost:5173/api/...` through the Vite proxy, same as the browser).
6. Run requests from the sidebar; tests show pass/fail in the extension. **Login** saves `token` in the collection environment for Bearer requests (**Get My Profile**, **Record Attempt**, **My Attempts**).

The extension, desktop Bruno app, and CLI all use the same `.bru` files and `environments/*.bru` files—nothing extra is required for VS Code.

### Desktop app or CLI

1. In Bruno, choose **Open Collection** and select this `bruno/` folder.
2. Pick the **Production** (`https://sweeple.natreese.dev`) or **Local** (`http://localhost:5173`) environment.
3. Set `login` and secret `password` for **Login** (account must be verified).
4. Set `email` for resend / forgot flows (often the same as the account email).
5. After **Register**, copy the verify token from `docker compose logs backend` into secret `verifyToken` before **Verify Email** and **Login**.

## Suggested flows

**New user (auth only)**

1. Register → Login - Unverified (optional) → Register - Duplicate (optional)  
2. Verify Email (token from logs) → Login → Get My Profile  

**Game smoke (after Login)**

1. Login  
2. Record Attempt  
3. My Attempts → Get Board (uses `seed` from step 2) → Board Attempts  
4. Leaderboard → Search Users  

**Public read (no login)**

List Boards → Get Board → Board Attempts → Leaderboard → Search Users  

Password reset: **Forgot Password** → paste `resetToken` from logs → **Reset Password** → **Login** with `newPassword`.

## Command line

```bash
npx @usebruno/cli@4.3.0 run --env Local \
  --env-var login=USERNAME \
  --env-var email=USER@example.com \
  --env-var password=PASSWORD \
  --env-var seed=daily-2026-10-20
```

Run from this folder. Overwrite `verifyToken` and `resetToken` the same way when needed (`--env-var verifyToken=...`). In the Bruno app, store `password` and tokens as secrets instead. Run a subset by naming `.bru` files on the command line.
