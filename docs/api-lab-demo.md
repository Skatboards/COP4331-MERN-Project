# API lab demo

How to demonstrate the API for the COP 4331C **MERN Project Lab - API Role**. The rubric has three parts:

| Part | Weight | What to show |
| --- | --- | --- |
| Source code | 40% | Connect to the team droplet, open the API source, and explain each endpoint's inputs, outputs, and database queries |
| Login in Bruno | 30% | HTTPS `POST` with JSON: a successful login (`200` with the user record) and a wrong password (`401` with an error message) |
| Register in Bruno | 30% | HTTPS `POST` with JSON: a successful registration (`201` with a confirmation message) |

## Before the lab

1. **Deploy the API.** Merge the API work into `main`; the CI `deploy` job updates the droplet (see [deploy/README.md](../deploy/README.md)).
2. **Set the droplet `.env`.** `JWT_SECRET` (output of `openssl rand -hex 32`) and `APP_URL=https://sweeple.natreese.dev`, then `docker compose up -d` in `/home/mern/sweeple`.
3. **Serve it over HTTPS.** The rubric requires HTTPS, so the requests go through nginx at `https://sweeple.natreese.dev/api/...`. Run `sudo deploy/switch-site.sh new` on the droplet (after the one-time nginx change in the deploy guide). Port 5000 from the class demos is not needed: opening it would serve plain HTTP.
4. **Have a verified account for Login.** Login returns `403 EMAIL_NOT_VERIFIED` until the email link is opened. Either:
   - **Register in Bruno**, copy the verification token from the droplet logs, run **Verify Email** in Bruno (or open the link in a browser), then use that username for **Login**, or
   - Use an account you already verified and set `login` / `password` in the Bruno environment.

   Without SMTP, find verification and reset links with:

   ```bash
   docker compose logs backend | grep -E 'verify-email|reset-password'
   ```

5. **Set up Bruno.** Open the [bruno/](../bruno/) folder as a collection. Choose **Production** for the lab (`https://sweeple.natreese.dev`) or **Local** for rehearsal (`http://localhost:5173`). Set:
   - `login` — username or email of a **verified** account (for **Login** and **Login - Wrong Password**)
   - secret `password` — that account's password
   - `email` — same user's email (for **Resend Verification** / **Forgot Password** when you demo those)
   - secrets `verifyToken` / `resetToken` — paste from logs when running **Verify Email** or **Reset Password**

   See [bruno/README.md](../bruno/README.md) for the full variable list.

6. **Rehearse locally.** With the stack running:

   ```bash
   cd bruno
   npx @usebruno/cli@4.3.0 run --env Local \
     --env-var login=USERNAME \
     --env-var email=USER@example.com \
     --env-var password=PASSWORD
   ```

   Run individual requests in the GUI if you do not have verification or reset tokens yet.

## Part 1: source code (40%)

```bash
ssh <user>@<droplet-ip>
cd /home/mern/sweeple/backend
vi routes/auth.js
```

| File | Contents |
| --- | --- |
| `server.js` | Express app, JSON body parsing, route mounting, error handler, MongoDB connection |
| `routes/auth.js` | Register, verify email, resend verification, login, forgot and reset password |
| `routes/oauth.js` | GitHub and Google sign-in (when configured) |
| `routes/users.js` | Profile, own games, search, leaderboard |
| `routes/boards.js` | Boards, attempts, recording a game |
| `middleware/auth.js` | Checks the `Authorization: Bearer` token |
| `lib/tokens.js`, `lib/email.js`, `lib/oauth.js` | JWT, one-time tokens, email, OAuth helpers |
| `models/` | Mongoose schemas for `users`, `boards`, `boardAttempts` |

Talking points for the two required endpoints:

**`POST /api/auth/register`**
- Input: `{ firstName, lastName, username, email, password }`. The username must be 3-20 letters, numbers, or underscores; the password 8-72 characters.
- Queries: `User.findOne({ $or: [{ username }, { email }] })` to reject duplicates (`409`), then `User.create(...)` with the bcrypt hash and the SHA-256 hash of a verification token.
- Output: `201 { message, user }`, and a verification email.

**`POST /api/auth/login`**
- Input: `{ login, password }`, where `login` is a username or email.
- Query: `User.findOne({ username })` or `{ email }`, including the normally hidden `passwordHash`, then `bcrypt.compare`.
- Output: `200 { token, user }`; `401 { error }` for a wrong password or unknown user (both take about the same time, so usernames can't be probed); `403` if the email is not verified.

The full list of endpoints is in the [README](../README.md#api) and [backend/openapi.yaml](../backend/openapi.yaml); the request flows are drawn in [data-flow.md](data-flow.md).

## Parts 2 and 3: Bruno (60%)

These three requests satisfy the rubric. Each has tests that Bruno shows as passed or failed.

| Request (rubric) | Expected |
| --- | --- |
| Register | `201` with "Account created. Check your email..." (makes a new `demo########` user each time) |
| Login | `200` with `user` and `token` (verified account) |
| Login - Wrong Password | `401` with "Incorrect username or password" |

Point out the `https://` URL, the `POST` method, and the JSON body and response in each request.

**Suggested lab order:** Register → (Verify Email or open the email link) → Login → Login - Wrong Password → **Get My Profile** (optional, shows Bearer token use).

### Extra auth requests (same collection)

The [bruno/](../bruno/) folder also includes requests you can demo or use while developing; they are not required for the rubric:

| Request | Expected |
| --- | --- |
| Register - Duplicate | `409` after Register (reuses the same username and email) |
| Get Auth Providers | `200`; lists `password` and any configured OAuth providers |
| Verify Email | `200` with `{ token }` from the verification email |
| Resend Verification | `200` for an unverified email |
| Login - Unverified | `403` with `EMAIL_NOT_VERIFIED` (Register, then run before verify) |
| Forgot Password | `200`; reset link in logs if SMTP is off |
| Reset Password | `200` with token from the reset email |
| Get My Profile | `200` with `Authorization: Bearer` token saved by Login |

OAuth browser redirects (`GET /api/auth/github`, callbacks) are not Bruno requests; show them in the client or refer to [oauth.md](oauth.md) and `backend/tests/oauth.test.js`.

### Boards and users (development smoke)

These requests are in the same [bruno/](../bruno/) collection for rehearsing the game loop; they are not part of the API Role rubric:

| Request | Expected |
| --- | --- |
| List Boards | `200`; may set `seed` from the first board |
| Get Board | `200` for env `seed` (seed data includes `daily-2026-10-20`) |
| Board Attempts | `200` with finished games on that board |
| Record Attempt | `201` after **Login**; uses a new board seed each run |
| My Attempts | `200` for the logged-in user |
| Leaderboard | `200`; env `leaderboardSort` |
| Search Users | `200`; env `searchQuery` |

Suggested order after **Login**: Record Attempt → My Attempts → Get Board → Board Attempts → Leaderboard.
