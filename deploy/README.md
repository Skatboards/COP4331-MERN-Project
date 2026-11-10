# Deployment

Every push to `main` that passes CI is deployed to the DigitalOcean droplet by the `deploy` job in [.github/workflows/ci.yml](../.github/workflows/ci.yml). The job SSHes into the droplet and uses the optimized production Compose file:

```bash
cd /home/mern/sweeple
git fetch --prune origin main
git reset --hard origin/main
export IMAGE_TAG="$(git rev-parse HEAD)"
docker compose -f compose.prod.yaml build backend
docker compose -f compose.prod.yaml build client
docker compose -f compose.prod.yaml up -d --no-build --remove-orphans --wait
```

The backend and client builds run sequentially to reduce peak memory use. Production has no source or `node_modules` mounts; the named `mongo_data` volume is retained.

It then checks `/api/health` from inside the backend container. Public HTTPS checks and rollback

`git reset --hard` discards any edits made directly in the droplet's checkout. Make changes through `main`. Ignored files such as `.env` are kept, and so is the `mongo_data` volume.

## Droplet layout

- Checkout: `/home/mern/sweeple` (cloned over HTTPS; the repository is public).
- `.env` in that folder (not committed):

  ```bash
  CLIENT_PORT=5173
  BACKEND_PORT=3001
  APP_URL=https://sweeple.natreese.dev
  JWT_SECRET=<output of: openssl rand -hex 32>
  GITHUB_CLIENT_ID=<GitHub OAuth client ID>
  GITHUB_CLIENT_SECRET=<GitHub OAuth client secret>
  GOOGLE_CLIENT_ID=<Google OAuth client ID>
  GOOGLE_CLIENT_SECRET=<Google OAuth client secret>
  # Outgoing email (see "Email" below)
  SMTP_HOST=
  SMTP_PORT=2465
  SMTP_USER=
  SMTP_PASS=
  MAIL_FROM=Sweeple <no-reply@natreese.dev>
  ```

  - The production client and backend ports are bound to `127.0.0.1` by `compose.prod.yaml`, and MongoDB is not published to the host. Port 3000 is left for the existing pm2 app.
  - `APP_URL` is the address used in the links in verification and reset emails.
  - `JWT_SECRET` signs login tokens. Without it the backend picks a random secret at each start, so every deploy logs everyone out.

  After editing `.env`, apply it with `IMAGE_TAG="$(git rev-parse HEAD)" docker compose -f compose.prod.yaml up -d --no-build` in that folder.

- For the API lab, Bruno must reach the API over HTTPS, which needs nginx switched to this stack (below). See [docs/api-lab-demo.md](../docs/api-lab-demo.md).
- nginx on the droplet terminates HTTPS for `sweeple.natreese.dev` (Certbot certificate) and currently sends it to the older pm2 app on port 3000.

## Email

Account verification and password reset emails are sent over SMTP when `SMTP_HOST` is set. Until then the backend prints each email to its log, which is enough for testing: `docker compose -f compose.prod.yaml logs backend | grep -A4 '\[email\]'`.

DigitalOcean blocks outgoing SMTP on ports 25, 465, and 587 for many droplets. Use a transactional email provider (for example SendGrid, Mailgun, Brevo, or Resend) on a port it offers outside that range, such as 2525 or 2587, and put its SMTP host, port, username, and password in `.env`. Most providers also require verifying the sending domain (DNS records for `natreese.dev`), which needs the domain owner.

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

- See container status and logs on the droplet: `cd /home/mern/sweeple && docker compose -f compose.prod.yaml ps` and `docker compose -f compose.prod.yaml logs --tail 100`.
- `Host key verification failed` in the deploy job means the droplet's host key changed; update it in `ci.yml`.
