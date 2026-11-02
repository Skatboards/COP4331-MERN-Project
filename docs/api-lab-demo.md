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
4. **Have a verified account.** Login returns `403 EMAIL_NOT_VERIFIED` until the email link is opened. Register an account, then open its link. Without SMTP, find it with:

   ```bash
   docker compose logs backend | grep verify-email
   ```

5. **Set up Bruno.** Open the [bruno/](../bruno/) folder as a collection, choose the **Production** environment, and set `login` and the secret `password` to that verified account.
6. **Rehearse locally.** With the stack running, the **Local** environment runs the same requests against `http://localhost:5173`:

   ```bash
   cd bruno
   npx @usebruno/cli@4.3.0 run --env Local --env-var login=USERNAME --env-var password=PASSWORD
   ```

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
| `routes/users.js` | Profile, own games, search, leaderboard |
| `routes/boards.js` | Boards, attempts, recording a game |
| `middleware/auth.js` | Checks the `Authorization: Bearer` token |
| `lib/tokens.js`, `lib/email.js` | JWT and one-time tokens; sending email |
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

Run the requests in this order. Each has tests that Bruno shows as passed or failed.

| Request | Expected |
| --- | --- |
| Register | `201` with "Account created. Check your email..." (makes a new `demo########` user each time) |
| Login | `200` with `user` and `token` |
| Login - Wrong Password | `401` with "Incorrect username or password" |
| Get My Profile (optional) | `200`, using the token saved by Login |

Point out the `https://` URL, the `POST` method, and the JSON body and response in each request.
