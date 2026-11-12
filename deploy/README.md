# Deployment

Every push to `main` that passes CI is deployed to the DigitalOcean droplet by the `deploy` job in [.github/workflows/ci.yml](../.github/workflows/ci.yml). The job deploys the exact commit tested by that workflow, even if `main` advances while the job is running:

```bash
cd /absolute/path/configured-in-DROPLET_APP_PATH
git fetch --prune origin main
git checkout --detach --force "$DEPLOY_SHA"
bash deploy/release.sh deploy "$DEPLOY_SHA" "$RUNTIME_ENV_ID"
```

[`release.sh`](release.sh) validates the production configuration, builds the backend and then the client sequentially, records disk and memory diagnostics, and starts the prebuilt images with `--no-build --wait`. Production has no source or `node_modules` mounts; the named `mongo_data` volume is retained.

CI uses Buildx with separate GitHub Actions cache scopes for each development
and production image. Those remote CI caches speed up repeated workflow builds
but are not downloaded to the droplet. Deployment uses the droplet's local
BuildKit layer cache: `release.sh` finishes the backend build before starting
the client build so the two Node builds cannot compete for memory. Only after a
release passes every public check does finalization prune dangling images and
builder cache older than seven days. The current and immediately previous
SHA-tagged application images remain available for rollback.

The production client remains containerized and runs the locked `serve`
runtime. It does not contain Nginx. The existing host Nginx installation owns
TLS and routes client paths to `127.0.0.1:${CLIENT_PORT}` and `/api` directly to
`127.0.0.1:${BACKEND_PORT}`.

The GitHub-hosted runner checks `/`, `/play`, `/archive`,
`/archive/daily-2026-10-20`, and `/settings` at `PUBLIC_URL` over HTTPS and
requires the client application marker in every response. It also validates
the JSON returned by `/api/health` and `/api/health/ready`; the latter returns
generic readiness after a bounded MongoDB ping and caches the result for five
seconds. Normal TLS certificate verification remains enabled.
Only after the complete check set succeeds does the workflow record the SHA as
successful and prune dangling image layers and build cache older than seven
days. SHA-tagged current and previous application images are retained.

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

If a build fails before replacement starts, the running stack remains unchanged and the checkout returns to the running release. If startup or any public HTTPS check fails after replacement starts, the workflow captures status and recent logs, checks out the previous successful SHA, recreates its images with `--no-build --wait`, and repeats the complete public route and health check set. A first deployment has no rollback target, so a failure preserves diagnostic state for manual recovery.

## Droplet layout

- Checkout: the absolute path stored in the `DROPLET_APP_PATH` GitHub environment secret (the repository is cloned over HTTPS).
- Protected environments and deployment state: `<DROPLET_APP_PATH>/.deploy/`, managed by the workflow as described above.
- The production client and backend ports are bound to `127.0.0.1` by `compose.prod.yaml`, and MongoDB is not published to the host.
- `APP_URL` is used in verification links, password-reset links, and OAuth callbacks.
- `JWT_SECRET` signs login tokens and is required by the production configuration.
- `JWT_EXPIRES_IN` controls the login-token lifetime and defaults to `1d`.
- Before deployment, verify that the separately managed host Nginx upstreams match the `CLIENT_PORT` and `BACKEND_PORT` production variables. The workflow does not edit or reload Nginx.

## Email

Account verification and password reset emails are sent over SMTP when `SMTP_HOST` is set. Until then the backend prints each email to its log. To inspect the backend logs for the currently deployed release:

```bash
cd /absolute/path/configured-in-DROPLET_APP_PATH
read -r IMAGE_TAG RUNTIME_ENV_ID < .deploy/last-successful-release
export IMAGE_TAG
docker compose --env-file ".deploy/environments/${RUNTIME_ENV_ID}.env" \
  -f compose.prod.yaml logs --tail 100 backend
```

Add `| grep -A4 '\[email\]'` to the final command to show only the development email output.

DigitalOcean blocks outgoing SMTP on ports 25, 465, and 587 for many droplets. Use a transactional email provider (for example SendGrid, Mailgun, Brevo, or Resend) on a port it offers outside that range, such as 2525 or 2587, and configure its values in the GitHub `production` environment. Most providers also require verifying the sending domain (DNS records for `natreese.dev`), which needs the domain owner.

## Host Nginx integration

Host Nginx is already configured and is managed outside this deployment. Do
not add Nginx to the client image and do not modify the host configuration from
GitHub Actions or `release.sh`. The required routing contract is:

- Client and asset requests go to the loopback client port configured by
  `CLIENT_PORT` (example: `127.0.0.1:5173`).
- `/api` requests go directly to the loopback backend port configured by
  `BACKEND_PORT` (example: `127.0.0.1:3001`).
- MongoDB remains reachable only on the internal Compose network.

Confirm those upstream ports with the droplet owner whenever the GitHub
variables change. The public workflow checks verify the effective HTTPS and
routing configuration without changing it. The legacy `switch-site.sh` helper
is not invoked by the current deployment workflow.

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
| `JWT_EXPIRES_IN` | Login-token lifetime accepted by `jsonwebtoken`; defaults to `1d` when omitted | `1d` |
| `SITE_ADMIN_EMAILS` | Optional comma-separated verified account emails promoted to `siteadmin`; removing an address does not demote the account | `owner@example.com` |
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
| `DROPLET_USER` | SSH user whose `authorized_keys` contains the deployment key | `deploy` |
| `DROPLET_APP_PATH` | Absolute path to the repository checkout | `/srv/sweeple` |
| `SSH_PRIVATE_KEY` | Complete multiline private key matching the deployment entry in `DROPLET_USER`'s `authorized_keys` | Begins with `-----BEGIN OPENSSH PRIVATE KEY-----` and ends with its matching `END` line |
| `JWT_SECRET` | Required long, random JWT signing secret | 64 hexadecimal characters generated by `openssl rand -hex 32` |
| `SMTP_PASS` | SMTP password or API token; required when `SMTP_USER` is set | Provider-issued token, or leave unset with `SMTP_USER` |
| `OAUTH_GITHUB_CLIENT_SECRET` | Required GitHub OAuth client secret; mapped to `GITHUB_CLIENT_SECRET` for Compose | Provider-issued GitHub OAuth client secret |
| `GOOGLE_CLIENT_SECRET` | Required Google OAuth client secret | `GOCSPX-...` |

`DROPLET_USER` and `DROPLET_APP_PATH` are intentionally stored as GitHub
environment **secrets**, and the workflow reads them through the `secrets`
context. Do not create same-named Actions variables: they will not be used.
Although these values are less sensitive than credentials, masking them avoids
publishing deployment-account and filesystem-layout details in workflow logs.

The workflow validates required values, complete OAuth credential pairs, HTTPS origins, ports, the full commit SHA, and basic SSH formatting before opening a connection. Errors report configuration names only, never values. Runtime values containing newlines are rejected so the generated Compose environment remains one assignment per line.

`DROPLET_HOST_KEY` is used with `StrictHostKeyChecking=yes`; it is a trust anchor even though it is public. Obtain and verify the expected fingerprint through an independent channel before saving the full public key. Do not establish trust by running `ssh-keyscan` inside every deployment. If the droplet is rebuilt, independently verify the new fingerprint and then replace the environment variable. Never put the server's private host key in GitHub.

GitHub does not allow Actions variables or secrets whose names begin with `GITHUB_`. The workflow therefore maps `OAUTH_GITHUB_CLIENT_ID` and `OAUTH_GITHUB_CLIENT_SECRET` to the application's `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` names. `JWT_SECRET`, OAuth client secrets, `SMTP_PASS`, and the private SSH key must remain GitHub environment secrets rather than unmasked configuration variables.

## Troubleshooting

- See the current release and environment identifier: change to the path configured in the `DROPLET_APP_PATH` secret, then run `cat .deploy/last-successful-release`.
- `Missing production environment configuration` means one or more required values are absent from the GitHub `production` environment. The message lists names only, never values.
- `Missing protected runtime environment for rollback release` means saved rollback state no longer has its matching mode-`0600` environment file; repair that state before replacing containers.
- `Host key verification failed` means the server did not present the public key stored in the `DROPLET_HOST_KEY` production environment variable. Verify whether the server was legitimately rebuilt or rekeyed before changing the variable.
