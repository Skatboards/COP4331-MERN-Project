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

From this directory, install dependencies and start the development server:

```sh
npm ci
npm run dev
```

The Vite development server proxies `/api` requests to `http://backend:3000`, so the backend needs to be reachable by that hostname (as it is in the project’s Compose network). For a production bundle, use `npm run build` and serve the generated `dist/` directory with the project’s web server or run `npm run preview` for a local preview.

## Scripts and checks

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server. |
| `npm run build` | Type-check the app and create a production bundle in `dist/`. |
| `npm run preview` | Serve the production bundle locally. |
| `npm run lint` | Run ESLint over the client project. |
| `npm test` | Run the Node test suite for Minesweeper board generation and game-state rules. |

The game tests cover deterministic daily seeds, mine placement and adjacency counts, safe opening reveals, wins and losses, click efficiency, saved game parsing, and chording. There are currently no automated browser, component, or API integration tests.

## Known issues and limitations

- No specific frontend bugs are currently documented.
- API-backed features require the backend service. If running Vite outside the Compose network, the `/api` proxy target may need to be changed from `backend:3000` to the backend’s reachable host and port.
- The automated suite covers game logic, but does not exercise the interface or backend integration.
