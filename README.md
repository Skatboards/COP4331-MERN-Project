# Sweeple App

Solve the daily minesweeper board! Every player gets the same board each day and has one attempt to solve it. Compare your click efficiency and completion rates against other players. Includes per-user stats and game history.

## Technology stack

- React 19, TypeScript, and Vite 8
- Node.js 24, Express 5, and Mongoose
- MongoDB 7.0
- Docker Compose for local development
- GitHub Actions for linting, builds, API tests, Compose smoke tests, and deployment

## Repository structure

```text
.
├── client/          React and Vite frontend
├── backend/         Express API (see backend/openapi.yaml)
├── bruno/           Bruno collection for auth API requests (with tests)
├── mongo/init/      MongoDB initialization directory
├── deploy/          Droplet deployment notes and scripts
├── docs/            Diagrams (system design, data flow, ERD), OAuth setup, API lab walkthrough
├── compose.dev.yaml   Local development stack
├── compose.prod.yaml  Optimized production stack
└── .github/         Continuous integration configuration
```

## Prerequisites

The recommended development setup requires:

- Docker with Docker Compose

To run services directly on the host instead, install Node.js 24, npm, and MongoDB 7.0.

## Configuration

Copy the example environment file before starting the stack:

```bash
cp .env.example .env
```

| Variable | Default | Description |
| --- | --- | --- |
| `CLIENT_PORT` | `5173` | Frontend port exposed on the host |
| `BACKEND_PORT` | `3000` | Express port exposed on the host |
| `MONGO_DATABASE` | `GameDB` | MongoDB database name |
| `MONGO_PORT` | `27017` | MongoDB port exposed on `127.0.0.1` |
| `JWT_SECRET` | placeholder | Secret for signing login tokens. Replace the example's placeholder with your own value (`openssl rand -hex 32`) so logins survive restarts. If empty, a random secret is used per run |
| `APP_URL` | `http://localhost:5173` | Site address used in the links in emails |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` | empty, `587`, `false` | Outgoing mail server. With `SMTP_HOST` empty, emails are printed to the backend log |
| `MAIL_FROM` | `Sweeple <no-reply@localhost>` | Sender of verification and reset emails |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | empty | Turns on "Continue with GitHub" (see [docs/oauth.md](docs/oauth.md)) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | empty | Turns on "Continue with Google" |

## Running with Docker Compose

Build and start the complete development stack:

```bash
docker compose -f compose.dev.yaml up --build
```

The client and server source directories are bind-mounted into their containers. Vite uses filesystem polling and the server uses Nodemon, so source changes should reload without rebuilding the images.

### Service URLs

| Service | URL |
| --- | --- |
| Client | <http://localhost:5173> |
| Express server | <http://localhost:3000> |
| Health endpoint | <http://localhost:3000/api/health> |
| Health endpoint through Vite | <http://localhost:5173/api/health> |
| MongoDB | `mongodb://127.0.0.1:27017/GameDB` |

Useful commands:

```bash
docker compose -f compose.dev.yaml ps
docker compose -f compose.dev.yaml logs --follow
docker compose -f compose.dev.yaml down
```

`docker compose -f compose.dev.yaml down` preserves the MongoDB volume. Adding `--volumes` also deletes local database data and cannot be undone.

## Client

The client is a routed React app ([client/src/App.tsx](client/src/App.tsx)): home, play, archive, settings, and password reset pages. Signing in happens in a dialog ([SignInDialog.tsx](client/src/components/SignInDialog.tsx)); the login state lives in [client/src/auth/](client/src/auth/).

- **Continue with GitHub** and **Continue with Google** buttons appear for each provider configured on the server (`GET /api/auth/providers`). After the provider, the server returns to `/#token=`; the app reads the token once and removes it from the address bar. Errors come back as `?oauthError=` and open the dialog with a message. See [docs/oauth.md](docs/oauth.md).
- Players can also create an email and password account, which asks them to verify their email, and sign in with a username or email and password. The token and user are saved in `localStorage`.
- An account whose email is not verified can resend the verification email from the dialog.
- The link in the verification email returns to `/?verified=1` (or `0` if the link was invalid or expired), which opens the dialog with a message.

## Running without Docker

Install and start the client:

```bash
cd client
npm ci
npm run dev
```

In another terminal, install and start the server:

```bash
cd backend
npm ci
npm run dev
```

The Vite proxy currently targets the Compose service name `backend`. `/api` requests from a client running directly on the host require a local proxy target such as `http://localhost:3000`.

## Development commands

Run these commands from the applicable package directory.

### Client

```bash
npm run dev
npm run lint
npm run build
npm run preview
```

### Backend

```bash
npm run dev
npm start
npm test
```

`npm test` runs the API tests in `backend/tests/` (at least one per endpoint) against a temporary in-memory MongoDB 7.0. It needs no running database; the first run downloads the MongoDB binary.

### Bruno (API requests)

Use the [bruno/](bruno/) folder as the collection in the **Bruno VS Code extension**, the Bruno desktop app, or the CLI. For local work, select the **Local** environment (`http://localhost:5173`) with Docker Compose running. Step-by-step for the extension: [bruno/README.md](bruno/README.md#vs-code--cursor-bruno-extension).

From the `bruno/` folder on the command line:

```bash
cd bruno
npx @usebruno/cli@4.3.0 run --env Local \
  --env-var login=USERNAME \
  --env-var email=USER@example.com \
  --env-var password=YOUR_PASSWORD
```

The collection covers **auth**, **boards**, and **users** endpoints that fit Bruno (register through profile, list/record attempts, leaderboard, search). OAuth sign-in itself is browser-only; use **Get Auth Providers** to see what the server exposes. Full request list, environment variables, and flows: [bruno/README.md](bruno/README.md). API Role lab demo script: [docs/api-lab-demo.md](docs/api-lab-demo.md).

## API

All requests and responses are JSON. The full description is in [backend/openapi.yaml](backend/openapi.yaml); import it into SwaggerHub to try the endpoints. For manual and scripted checks against a running stack, use the [bruno/](bruno/) collection ([bruno/README.md](bruno/README.md)). Endpoints marked *login* need an `Authorization: Bearer <token>` header with the token from `POST /api/auth/login`.

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/health` | Returns `{ "status": "ok" }` |
| `GET` | `/api/ping` | Returns `{ "message": "Hello World" }` |
| `POST` | `/api/auth/register` | Create an account and email a verification link |
| `GET` | `/api/auth/verify-email?token=` | The link in the email: verifies, then redirects to the site with `?verified=1` or `0` |
| `POST` | `/api/auth/verify-email` | Verify with `{ token }` (for the mobile app) |
| `POST` | `/api/auth/resend-verification` | Email a new verification link |
| `POST` | `/api/auth/login` | Log in with `{ login, password }` (username or email); returns a token. Unverified accounts get `403` |
| `GET` | `/api/auth/providers` | Ways to sign in: `password`, plus `github` and `google` when configured |
| `GET` | `/api/auth/github`, `/api/auth/google` | Open in a browser to sign in with that provider; returns to the site with `#token=` |
| `GET` | `/api/auth/:provider/callback` | Where the provider sends the browser back |
| `POST` | `/api/auth/forgot-password` | Email a password reset link to `/reset-password?token=` on the site |
| `POST` | `/api/auth/reset-password` | Set a new password with `{ token, password }` |
| `GET` | `/api/users/me` | *login* The user's profile and stats |
| `GET` | `/api/users/me/attempts` | *login* The user's games, newest first |
| `GET` | `/api/users/search?q=` | Find players by username or name |
| `GET` | `/api/users/leaderboard?sort=` | Top players by `boardsCompleted`, `efficiency`, or `totalClicks` |
| `GET` | `/api/boards` | Most recent boards |
| `GET` | `/api/boards/:seed` | One board's global stats |
| `GET` | `/api/boards/:seed/attempts` | Best finished games on a board |
| `POST` | `/api/boards/:seed/attempts` | *login* Record a finished game `{ clicks, status: "won" \| "lost", efficiency }`; one per user per board |

Passwords are hashed with bcrypt. GitHub and Google sign-in use the authorization code flow with state and PKCE. Verification and reset tokens are single-use, expire (24 hours and 1 hour), and only their SHA-256 hashes are stored. The forgot-password and resend endpoints answer the same way whether or not an email is registered.

The backend receives `MONGODB_URI` from Compose and connects with Mongoose. `backend/server.js` is the entry point: it sets up the app and mounts the routes in `backend/routes/`, then connects to MongoDB and starts listening when run directly (tests load it with `require()` instead).

## Database initialization

MongoDB mounts `mongo/init/` at `/docker-entrypoint-initdb.d`. The official image runs supported initialization files only when it creates a new, empty database volume.

`01-create-schema.js` creates the collections and unique indexes, and `02-seed-data.js` inserts sample data. See [mongo/README.md](mongo/README.md).

## Continuous integration

The workflow in [.github/workflows/ci.yml](.github/workflows/ci.yml) runs on pushes and pull requests targeting `main`. It:

- Uses Node.js 24 for the client and backend
- Installs dependencies and runs available lint, build, and test scripts (including the backend API tests)
- Validates the development and production Compose configurations
- Builds all four development and production images sequentially with Buildx caching
- Starts the prebuilt production stack and checks real client routes and the Express health endpoint
- Confirms production starts with no sample records
- Captures service logs on failure and cleans up the stack

After every check passes on a push to `main`, the `deploy` job SSHes into the DigitalOcean droplet, resets its checkout to `main`, and rebuilds the backend and client sequentially with `compose.prod.yaml`. See [deploy/README.md](deploy/README.md) for droplet setup and the required repository secrets.

## Troubleshooting

### A port is already in use

Change the corresponding value in `.env`, or stop the process using the port.

### A container is unhealthy

Inspect its status and logs:

```bash
docker compose -f compose.dev.yaml ps
docker compose -f compose.dev.yaml logs <service-name>
```

### Dependencies are stale inside a container

Each container keeps its installed packages in an anonymous volume. After pulling a change to a `package.json`, rebuild and recreate those volumes (the MongoDB data is kept):

```bash
docker compose -f compose.dev.yaml up --build --renew-anon-volumes
```

### Where is the verification email?

Without `SMTP_HOST`, the backend prints each email, including its link, to its log:

```bash
docker compose -f compose.dev.yaml logs backend
```

### Everyone is logged out after the backend restarts

`JWT_SECRET` is empty, so the backend made a new random secret at startup and old tokens no longer verify. Set it in `.env` and run `docker compose -f compose.dev.yaml up -d backend`.
