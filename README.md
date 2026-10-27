# Sweeple App

Solve the daily minesweeper board! Every player gets the same board each day and has one attempt to solve it. Compare your click efficiency and completion rates against other players. Includes per-user stats and game history.

## Technology stack

- React 19, TypeScript, and Vite 8
- Node.js 24 and Express 4
- MongoDB 8
- Docker Compose for local development
- GitHub Actions for linting, builds, and Compose smoke tests

## Repository structure

```text
.
├── client/          React and Vite frontend
├── server/          Express API
├── mongo/init/      MongoDB initialization directory
├── compose.yaml     Local development stack
└── .github/         Continuous integration configuration
```

## Prerequisites

The recommended development setup requires:

- Docker with Docker Compose

To run services directly on the host instead, install Node.js 24, npm, and MongoDB 8.

## Configuration

Copy the example environment file before starting the stack:

```bash
cp .env.example .env
```

| Variable | Default | Description |
| --- | --- | --- |
| `CLIENT_PORT` | `5173` | Frontend port exposed on the host |
| `SERVER_PORT` | `3000` | Express port exposed on the host |
| `MONGO_DATABASE` | `mern_app` | MongoDB database name |
| `MONGO_PORT` | `27017` | MongoDB port exposed on `127.0.0.1` |

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
| MongoDB | `mongodb://127.0.0.1:27017/mern_app` |

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
cd server
npm ci
npm run dev
```

The Vite proxy currently targets the Compose service name `server`. `/api` requests from a client running directly on the host require a local proxy target such as `http://localhost:3000`.

## Development commands

Run these commands from the applicable package directory.

### Client

```bash
npm run dev
npm run lint
npm run build
npm run preview
```

### Server

```bash
npm run dev
npm start
```

Automated client and server test scripts have not yet been configured.

## API

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/health` | Returns `{ "status": "ok" }` |
| `GET` | `/users` | Returns the current placeholder users response |

The server receives `MONGO_URI` from Compose, but application-level MongoDB access has not yet been implemented.

## Database initialization

MongoDB mounts `mongo/init/` at `/docker-entrypoint-initdb.d`. The official image runs supported initialization files only when it creates a new, empty database volume.

The initialization scripts referenced in [mongo/README.md](mongo/README.md) are not currently present in `mongo/init/`. Add them before relying on schema or seed initialization.

## Continuous integration

The workflow in [.github/workflows/ci.yml](.github/workflows/ci.yml) runs on pushes and pull requests targeting `main`. It:

- Uses Node.js 24 for the client and server
- Installs dependencies and runs available lint, build, and test scripts
- Validates the Compose configuration
- Builds and starts all services
- Checks the client, Express health endpoint, and Vite proxy
- Captures service logs on failure and cleans up the stack

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

Recreate the dependency volumes and rebuild the stack. This also removes the MongoDB volume, so preserve any data you need first:

```bash
docker compose down --volumes
docker compose up --build
```