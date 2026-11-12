# Sweeple frontend

Sweeple is a React, TypeScript, and Vite Minesweeper game. The frontend provides a daily puzzle, account sign-in and registration, player settings, a board archive, and a leaderboard. Guest game progress and theme preferences are stored locally. Signed-in game progress, account data, and leaderboard results use the backend API under `/api`.

## Main pages

- `/` — landing page with the play link, rules, and player leaderboard.
- `/play` — today’s playable board.
- `/archive` — signed-in users’ past attempts and player stats.
- `/archive/:seed` — read-only view of an archived board.
- `/settings` — account and display preferences.
- `/reset-password` — password reset flow.
- `/admin` — admin dashboard for admins and site admins: search, create, edit, reset, and delete accounts, and (site admins) promote or demote admins. Other visitors are sent to `/`. See [docs/admin.md](../docs/admin.md).

## Developer reference pages

When running the Vite development server, use `/dev/components` for a small showcase of shared interface components and `/dev/colors` to inspect the semantic color tokens in the current theme. The color swatches update with the theme control in the site header. These routes are registered only when `import.meta.env.DEV` is true and are omitted from production builds.

## Setup

From this directory, install dependencies and start the Vite development
server:

```sh
npm ci
npm run dev
```

The Vite server is development-only. It proxies `/api` requests to
`http://backend:3000`, so that hostname must be reachable, as it is in the
development Compose network. `npm run preview` is also for local inspection of
a build and is not the production server.

## Production runtime

`npm run build` creates the static application in `dist/`. The production
Dockerfile builds that directory in one stage, then copies it into a non-root
Node container that installs only the locked dependencies from
[`runtime/package.json`](runtime/package.json) and
[`runtime/package-lock.json`](runtime/package-lock.json). The established
`serve` package runs with [`serve.json`](serve.json) to provide SPA fallbacks
and cache headers. Vite, React's build dependencies, and the client source tree
are not installed in the runtime stage.

The production client remains a container. It does not contain Nginx and does
not proxy `/api`. The existing Nginx service on the production host terminates
HTTPS and routes public client traffic to the loopback-bound client container
port and `/api` traffic directly to the loopback-bound backend container port.
That host configuration is managed separately from this repository's
deployment workflow.

## Scripts and checks

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server. |
| `npm run build` | Type-check the app and create a production bundle in `dist/`. |
| `npm run preview` | Inspect the production bundle locally; not used for deployment. |
| `npm run lint` | Run ESLint over the client project. |
| `npm test` | Run the Node test suite for Minesweeper board generation and game-state rules. |

The game tests cover deterministic daily seeds, mine placement and adjacency counts, safe opening reveals, wins and losses, click efficiency, saved game parsing, and chording. There are currently no automated browser, component, or API integration tests.

## Known issues and limitations

- No specific frontend bugs are currently documented.
- API-backed features require the backend service. If running Vite outside the Compose network, the `/api` proxy target may need to be changed from `backend:3000` to the backend’s reachable host and port.
- The automated suite covers game logic, but does not exercise the interface or backend integration.
