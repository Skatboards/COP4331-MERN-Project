# Deployment

Every push to `main` that passes CI is deployed to the DigitalOcean droplet by the `deploy` job in [.github/workflows/ci.yml](../.github/workflows/ci.yml). The job SSHes into the droplet and runs the same `compose.yaml` used for development:

```bash
cd /home/mern/sweeple
git fetch --prune origin main
git reset --hard origin/main
docker compose up -d --build --remove-orphans --wait
```

It then checks `http://127.0.0.1:5173/api/health` on the droplet (the client port, through the Vite proxy to the backend). If that fails, the job fails. Once nginx serves this stack, this check can move to `https://sweeple.natreese.dev/api/health`.

`git reset --hard` discards any edits made directly in the droplet's checkout. Make changes through `main`. Ignored files such as `.env` are kept, and so is the `mongo_data` volume.

## Droplet layout

- Checkout: `/home/mern/sweeple` (cloned over HTTPS; the repository is public).
- `.env` in that folder (not committed):

  ```bash
  DOMAIN=sweeple.natreese.dev
  CLIENT_PORT=127.0.0.1:5173
  BACKEND_PORT=127.0.0.1:3001
  MONGO_PORT=27017
  ```

  - `DOMAIN` lets Vite accept requests for the domain (it rejects unknown hostnames otherwise).
  - The client, backend, and MongoDB are bound to `127.0.0.1`, so nothing is reachable from the internet directly. Port 3000 is left for the existing pm2 app.

- nginx on the droplet terminates HTTPS for `sweeple.natreese.dev` (Certbot certificate) and currently sends it to the older pm2 app on port 3000.

## Switching the domain to this stack

[`switch-site.sh`](switch-site.sh) swaps which app nginx serves, with no downtime:

```bash
sudo /home/mern/sweeple/deploy/switch-site.sh new     # this stack (127.0.0.1:5173)
sudo /home/mern/sweeple/deploy/switch-site.sh old     # the pm2 app (127.0.0.1:3000)
sudo /home/mern/sweeple/deploy/switch-site.sh status
```

It writes the target to `/etc/nginx/conf.d/sweeple-app.conf`, runs `nginx -t`, and reloads nginx; it refuses to switch to a port that is not answering and restores the previous file if the config test fails.

It needs a one-time nginx change first (agree it with the droplet owner): in the `sweeple.natreese.dev` HTTPS server block, change `proxy_pass http://localhost:3000;` to `proxy_pass http://sweeple_app;`, and make the `location ^~ /assets/` block `proxy_pass http://sweeple_app;` as well (nothing exists in `/var/www/html/assets`). Run `switch-site.sh old` once to create the upstream file before reloading.

The droplet has about 1 GB of RAM and no swap, so image builds during a deploy can run short of memory. A VS Code Remote-SSH session alone uses about 500 MB; disconnect it (or run "Remote-SSH: Kill VS Code Server on Host") before deploying.

## Repository secrets

The deploy job uses these existing repository secrets:

| Secret | Value |
| --- | --- |
| `DROPLET_HOST` | Droplet IP |
| `DROPLET_USER` | SSH user (the deploy key is authorized for `root`) |
| `SSH_PRIVATE_KEY` | Private key matching the `github-actions-deploy-MERN` entry in that user's `authorized_keys` |

The checkout path, the droplet's public SSH host key, and the site URL are set directly in the workflow because they are not secret. If the droplet is rebuilt, update the host key in `ci.yml` with `ssh-keyscan -t ed25519 <droplet-ip>`.

## Troubleshooting

- See container status and logs on the droplet: `cd /home/mern/sweeple && docker compose ps` and `docker compose logs --tail 100`.
- `Blocked request. This host is not allowed` means `DOMAIN` in `.env` does not match the domain in the browser.
- `Host key verification failed` in the deploy job means the droplet's host key changed; update it in `ci.yml`.
