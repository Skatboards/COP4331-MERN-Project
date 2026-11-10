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

It then checks `/api/health` from inside the backend container.

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

## GitHub production environment

The deploy job declares the GitHub Actions `production` environment. Configure its values under **Settings > Environments > production** rather than hardcoding deployment-specific configuration in the workflow. Environment protection rules can require approval or restrict which branches are allowed to deploy.

Add these non-sensitive values as **environment variables**:

| Variable | Value |
| --- | --- |
| `DROPLET_HOST` | Droplet hostname or IP address |
| `DROPLET_USER` | SSH user whose `authorized_keys` contains the deployment key |
| `DROPLET_APP_PATH` | Absolute checkout path, currently `/home/mern/sweeple` |
| `DROPLET_HOST_KEY` | Pinned public SSH host key in `<type> <base64-key>` form, such as `ssh-ed25519 AAAA...` |

Add this sensitive value as an **environment secret**:

| Secret | Value |
| --- | --- |
| `SSH_PRIVATE_KEY` | Private key matching the deployment entry in `DROPLET_USER`'s `authorized_keys` |

The workflow validates that every required variable and secret is non-empty before opening an SSH connection. GitHub Actions configuration variables are not masked in logs, so credentials and private keys must remain secrets. The hostname, username, checkout path, and public host key do not require secrecy.

`DROPLET_HOST_KEY` is used with `StrictHostKeyChecking=yes`; it is a trust anchor even though it is public. Obtain and verify the expected fingerprint through an independent channel before saving the full public key. Do not establish trust by running `ssh-keyscan` inside every deployment. If the droplet is rebuilt, independently verify the new fingerprint and then replace the environment variable. Never put the server's private host key in GitHub.

The application variables in the droplet's ignored `.env` file are runtime inputs to Compose and are separate from the Actions environment above. They remain on the server with the current deployment workflow. In particular, `JWT_SECRET`, OAuth client secrets, and `SMTP_PASS` must not be converted to GitHub configuration variables. If runtime-environment delivery is later moved into Actions, store sensitive values as production environment secrets and map permitted GitHub-side names to the names expected by Compose.

GitHub does not allow Actions variables or secrets whose names begin with `GITHUB_`. Use names such as `OAUTH_GITHUB_CLIENT_ID` and `OAUTH_GITHUB_CLIENT_SECRET` on GitHub, then map them to the application's `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` environment names in the workflow. The `GITHUB_` names shown in the droplet `.env` example are valid there because that file is read by Compose, not created as GitHub Actions configuration.

## Troubleshooting

- See container status and logs on the droplet: `cd /home/mern/sweeple && docker compose -f compose.prod.yaml ps` and `docker compose -f compose.prod.yaml logs --tail 100`.
- `Missing production environment configuration` means one or more required values are absent from the GitHub `production` environment. The message lists names only, never values.
- `Host key verification failed` means the server did not present the public key stored in the `DROPLET_HOST_KEY` production environment variable. Verify whether the server was legitimately rebuilt or rekeyed before changing the variable.
