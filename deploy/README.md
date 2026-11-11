# Deployment

Every push to `main` that passes CI is deployed to the DigitalOcean droplet by the `deploy` job in [.github/workflows/ci.yml](../.github/workflows/ci.yml). The job deploys the exact commit tested by that workflow, even if `main` advances while the job is running:

```bash
cd /home/mern/sweeple
git fetch --prune origin main
git checkout --detach --force "$DEPLOY_SHA"
bash deploy/release.sh deploy "$DEPLOY_SHA" "$RUNTIME_ENV_ID"
```

[`release.sh`](release.sh) validates the production configuration, builds the backend and then the client sequentially, records disk and memory diagnostics, and starts the prebuilt images with `--no-build --wait`. Production has no source or `node_modules` mounts; the named `mongo_data` volume is retained.

The GitHub-hosted runner checks `${PUBLIC_URL}/api/health` over HTTPS. Only after that succeeds does the workflow record the SHA as successful and prune dangling image layers and build cache older than seven days. SHA-tagged current and previous application images are retained.

The forced detached checkout discards edits to tracked files in the droplet checkout. Make changes through `main`. Ignored deployment state and runtime environments are retained, as is the `mongo_data` volume.

## Runtime configuration and rollback state

The workflow creates a release-specific Compose environment from the GitHub `production` environment without printing its contents. It transfers the file over the host-key-verified SSH connection and installs it with mode `0600` under the mode-`0700` `.deploy` directory:

```text
.deploy/
├── environments/<commit-sha>-<run-id>-<attempt>.env
├── last-successful-release
├── pending-previous-release    # present only during deployment
└── replacement-started         # present only after replacement begins
```

Compose always receives the appropriate file through `--env-file`. The state records both the Git commit and its runtime-environment identifier, so rollback restores matching code, images, and configuration—even when the same commit is redeployed with changed settings. `.deploy/` is ignored by Git and must never be committed, logged, cached, or uploaded as an artifact.

If a build fails before replacement starts, the running stack remains unchanged and the checkout returns to the running release. If startup or the public HTTPS check fails after replacement starts, the workflow captures status and recent logs, checks out the previous successful SHA, recreates its images with `--no-build --wait`, and repeats the public health check. A first deployment has no rollback target, so a failure preserves diagnostic state for manual recovery.

## Droplet layout

- Checkout: `/home/mern/sweeple` (cloned over HTTPS; the repository is public).
- Protected environments and deployment state: `/home/mern/sweeple/.deploy/`, managed by the workflow as described above.
- The production client and backend ports are bound to `127.0.0.1` by `compose.prod.yaml`, and MongoDB is not published to the host. Port 3000 is left for the existing pm2 app.
- `APP_URL` is used in verification links, password-reset links, and OAuth callbacks.
- `JWT_SECRET` signs login tokens and is required by the production configuration.

- For the API lab, Bruno must reach the API over HTTPS, which needs nginx switched to this stack (below). See [docs/api-lab-demo.md](../docs/api-lab-demo.md).
- nginx on the droplet terminates HTTPS for `sweeple.natreese.dev` (Certbot certificate) and currently sends it to the older pm2 app on port 3000.

## Email

Account verification and password reset emails are sent over SMTP when `SMTP_HOST` is set. Until then the backend prints each email to its log. To inspect the backend logs for the currently deployed release:

```bash
cd /home/mern/sweeple
read -r IMAGE_TAG RUNTIME_ENV_ID < .deploy/last-successful-release
export IMAGE_TAG
docker compose --env-file ".deploy/environments/${RUNTIME_ENV_ID}.env" \
  -f compose.prod.yaml logs --tail 100 backend
```

Add `| grep -A4 '\[email\]'` to the final command to show only the development email output.

DigitalOcean blocks outgoing SMTP on ports 25, 465, and 587 for many droplets. Use a transactional email provider (for example SendGrid, Mailgun, Brevo, or Resend) on a port it offers outside that range, such as 2525 or 2587, and configure its values in the GitHub `production` environment. Most providers also require verifying the sending domain (DNS records for `natreese.dev`), which needs the domain owner.

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

Enter values without surrounding shell quotes. `DROPLET_HOST` is an SSH hostname or IP address only: do not include `https://`, a username, a path, or a trailing slash. In contrast, `PUBLIC_URL` and `APP_URL` are web origins and must include `https://`. The examples below show the expected format only; replace them with the real deployment values.

Add these non-sensitive values as **environment variables**:

| Variable | Value | Example format |
| --- | --- | --- |
| `DROPLET_HOST` | Droplet hostname or IP address; no URL scheme | `203.0.113.10` or `sweeple.example.com` |
| `DROPLET_HOST_KEY` | Pinned public SSH host key in `<type> <base64-key>` form; use the full key, not only its fingerprint | `ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAA...` |
| `PUBLIC_URL` | Required canonical public HTTPS origin | `https://sweeple.natreese.dev` |
| `APP_URL` | Required application origin for email links and OAuth callbacks; normally the same as `PUBLIC_URL` | `https://sweeple.natreese.dev` |
| `CLIENT_PORT` | Required host Nginx upstream port for the client | `5173` |
| `BACKEND_PORT` | Required host Nginx upstream port for `/api` | `3001` |
| `MONGO_DATABASE` | MongoDB database name; defaults to `GameDB` | `GameDB` |
| `SMTP_HOST` | Optional SMTP host | `smtp.provider.example` or leave unset |
| `SMTP_PORT` | Optional SMTP port; defaults to `587` | `2525` |
| `SMTP_SECURE` | Optional `true` or `false`; defaults to `false` | `false` |
| `SMTP_USER` | Optional SMTP username; requires `SMTP_PASS` when set | `apikey` or leave unset |
| `MAIL_FROM_NAME` | Sender display name; required when `SMTP_HOST` is set and entered without surrounding quotes | `Sweeple` |
| `MAIL_FROM_ADDRESS` | Sender email address; required when `SMTP_HOST` is set | `no-reply@natreese.dev` |
| `OAUTH_GITHUB_CLIENT_ID` | Required GitHub OAuth client ID; mapped to `GITHUB_CLIENT_ID` for Compose | `Ov23liAbCdEf12345678` |
| `GOOGLE_CLIENT_ID` | Required Google OAuth client ID | `123456789012-abcdef.apps.googleusercontent.com` |

Add these values as **environment secrets**:

| Secret | Value | Example format |
| --- | --- | --- |
| `DROPLET_USER` | SSH user whose `authorized_keys` contains the deployment key | `mern` |
| `DROPLET_APP_PATH` | Absolute checkout path, currently `/home/mern/sweeple` | `/home/mern/sweeple` |
| `SSH_PRIVATE_KEY` | Complete multiline private key matching the deployment entry in `DROPLET_USER`'s `authorized_keys` | Begins with `-----BEGIN OPENSSH PRIVATE KEY-----` and ends with its matching `END` line |
| `JWT_SECRET` | Required long, random JWT signing secret | 64 hexadecimal characters generated by `openssl rand -hex 32` |
| `SMTP_PASS` | SMTP password or API token; required when `SMTP_USER` is set | Provider-issued token, or leave unset with `SMTP_USER` |
| `OAUTH_GITHUB_CLIENT_SECRET` | Required GitHub OAuth client secret; mapped to `GITHUB_CLIENT_SECRET` for Compose | Provider-issued GitHub OAuth client secret |
| `GOOGLE_CLIENT_SECRET` | Required Google OAuth client secret | `GOCSPX-...` |

The workflow validates required values, complete OAuth credential pairs, HTTPS origins, ports, the full commit SHA, and basic SSH formatting before opening a connection. Errors report configuration names only, never values. Runtime values containing newlines are rejected so the generated Compose environment remains one assignment per line.

`DROPLET_HOST_KEY` is used with `StrictHostKeyChecking=yes`; it is a trust anchor even though it is public. Obtain and verify the expected fingerprint through an independent channel before saving the full public key. Do not establish trust by running `ssh-keyscan` inside every deployment. If the droplet is rebuilt, independently verify the new fingerprint and then replace the environment variable. Never put the server's private host key in GitHub.

GitHub does not allow Actions variables or secrets whose names begin with `GITHUB_`. The workflow therefore maps `OAUTH_GITHUB_CLIENT_ID` and `OAUTH_GITHUB_CLIENT_SECRET` to the application's `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` names. `JWT_SECRET`, OAuth client secrets, `SMTP_PASS`, and the private SSH key must remain GitHub environment secrets rather than unmasked configuration variables.

## Troubleshooting

- See the current release and environment identifier: `cd /home/mern/sweeple && cat .deploy/last-successful-release`.
- `Missing production environment configuration` means one or more required values are absent from the GitHub `production` environment. The message lists names only, never values.
- `Missing protected runtime environment for rollback release` means saved rollback state no longer has its matching mode-`0600` environment file; repair that state before replacing containers.
- `Host key verification failed` means the server did not present the public key stored in the `DROPLET_HOST_KEY` production environment variable. Verify whether the server was legitimately rebuilt or rekeyed before changing the variable.
