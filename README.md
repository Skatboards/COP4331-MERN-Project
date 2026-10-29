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
├── bruno/           Bruno requests for testing the API
├── mongo/init/      MongoDB initialization directory
├── deploy/          Droplet deployment notes and scripts
├── docs/            System design, data flow, and ERD diagrams (Mermaid)
├── compose.yaml     Local development stack
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
| `JWT_SECRET` | random per run | Secret for signing login tokens. Set it on servers so logins survive restarts |
| `APP_URL` | `http://localhost:5173` | Site address used in the links in emails |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` | empty, `587`, `false` | Outgoing mail server. With `SMTP_HOST` empty, emails are printed to the backend log |
| `MAIL_FROM` | `Sweeple <no-reply@localhost>` | Sender of verification and reset emails |

## Running with Docker Compose

Build and start the complete development stack:

```bash
docker compose up --build
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
docker compose ps
docker compose logs --follow
docker compose down
```

`docker compose down` preserves the MongoDB volume. Running `docker compose down --volumes` also deletes local database data and cannot be undone.

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

## API

All requests and responses are JSON. The full description is in [backend/openapi.yaml](backend/openapi.yaml); import it into SwaggerHub to try the endpoints. The [bruno/](bruno/) folder has ready-made [Bruno](https://www.usebruno.com/) requests for register and login. Endpoints marked *login* need an `Authorization: Bearer <token>` header with the token from `POST /api/auth/login`.

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/health` | Returns `{ "status": "ok" }` |
| `GET` | `/api/ping` | Returns `{ "message": "Hello World" }` |
| `POST` | `/api/auth/register` | Create an account and email a verification link |
| `GET` | `/api/auth/verify-email?token=` | The link in the email: verifies, then redirects to the site with `?verified=1` or `0` |
| `POST` | `/api/auth/verify-email` | Verify with `{ token }` (for the mobile app) |
| `POST` | `/api/auth/resend-verification` | Email a new verification link |
| `POST` | `/api/auth/login` | Log in with `{ login, password }` (username or email); returns a token. Unverified accounts get `403` |
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

Passwords are hashed with bcrypt. Verification and reset tokens are single-use, expire (24 hours and 1 hour), and only their SHA-256 hashes are stored. The forgot-password and resend endpoints answer the same way whether or not an email is registered.

The backend receives `MONGODB_URI` from Compose and connects with Mongoose. `backend/server.js` is the entry point: it sets up the app and mounts the routes in `backend/routes/`, then connects to MongoDB and starts listening when run directly (tests load it with `require()` instead).

## Database initialization

MongoDB mounts `mongo/init/` at `/docker-entrypoint-initdb.d`. The official image runs supported initialization files only when it creates a new, empty database volume.

`01-create-schema.js` creates the collections and unique indexes, and `02-seed-data.js` inserts sample data. See [mongo/README.md](mongo/README.md).

## Continuous integration

The workflow in [.github/workflows/ci.yml](.github/workflows/ci.yml) runs on pushes and pull requests targeting `main`. It:

- Uses Node.js 24 for the client and backend
- Installs dependencies and runs available lint, build, and test scripts (including the backend API tests)
- Validates the Compose configuration
- Builds and starts all services
- Checks the client, Express health endpoint, and Vite proxy
- Captures service logs on failure and cleans up the stack

After every check passes on a push to `main`, the `deploy` job SSHes into the DigitalOcean droplet, resets its checkout to `main`, and rebuilds the stack with `compose.yaml`. See [deploy/README.md](deploy/README.md) for droplet setup and the required repository secrets.

## Troubleshooting

### A port is already in use

Change the corresponding value in `.env`, or stop the process using the port.

### A container is unhealthy

Inspect its status and logs:

```bash
docker compose ps
docker compose logs <service-name>
```

### Dependencies are stale inside a container

Each container keeps its installed packages in an anonymous volume. After pulling a change to a `package.json`, rebuild and recreate those volumes (the MongoDB data is kept):

```bash
docker compose up --build --renew-anon-volumes
```

### Where is the verification email?

Without `SMTP_HOST`, the backend prints each email, including its link, to its log:

```bash
docker compose logs backend
```