# System design

Sweeple is a MERN app with a React client, an Express API, and MongoDB.
[`compose.dev.yaml`](../compose.dev.yaml) provides the source-mounted local
development environment; [`compose.prod.yaml`](../compose.prod.yaml) defines
the optimized, loopback-bound production stack. The two environments are
explicit rather than layered on a shared default Compose file.

## Deployment overview

How a request reaches the app in production, and how code gets there.

```mermaid
flowchart LR
    subgraph Clients
        browser["Web browser<br/>(React app)"]
        mobile["Mobile app"]
        swagger["SwaggerHub / Bruno<br/>(API demo)"]
    end

    subgraph Edge
        cf["Cloudflare<br/>DNS + proxy"]
    end

    subgraph Droplet["DigitalOcean droplet"]
        nginx["nginx<br/>HTTPS (Certbot)<br/>sweeple.natreese.dev"]
        subgraph Stack["Docker Compose stack (project sweeple)"]
            client["client<br/>compiled React + serve<br/>127.0.0.1:5173"]
            backend["backend<br/>Express 5 + Mongoose<br/>127.0.0.1:3001 to :3000"]
            mongo[("mongo<br/>MongoDB 7.0<br/>internal network only")]
            vol[("mongo_data<br/>volume")]
        end
    end

    smtp["SMTP email provider"]
    idp["GitHub and Google<br/>OAuth"]
    inbox["User's inbox"]

    browser -->|HTTPS| cf
    mobile -->|HTTPS JSON| cf
    swagger -->|HTTPS JSON| cf
    cf --> nginx
    nginx -->|"client paths"| client
    nginx -->|"/api/*"| backend
    backend -->|Mongoose| mongo
    mongo --- vol
    backend -->|"verification and reset emails"| smtp
    smtp --> inbox
    backend -->|"code exchange,<br/>profile"| idp
```

- Only the separately managed host Nginx service is reachable from the internet. The client and backend host ports listen on `127.0.0.1`; MongoDB has no production host port.
- The production client is still a container, but it runs the locked `serve` static-server dependency rather than Vite or an embedded Nginx process.
- Host Nginx terminates HTTPS, sends client paths to the client container, and sends `/api/*` directly to the backend container. Deployment verifies this routing but does not modify Nginx.
- Without `SMTP_HOST`, the backend prints emails to its log instead of sending them.

## Containers

```mermaid
flowchart TB
    subgraph dev["compose.dev.yaml"]
        devClient["client: Vite<br/>source mount + hot reload"]
        devBackend["backend: Nodemon<br/>source mount + reload"]
        devMongo["MongoDB<br/>loopback host port"]
        devInit["schema + sample seed scripts"]
    end

    subgraph prod["compose.prod.yaml"]
        prodClient["client: compiled dist + serve<br/>loopback host port"]
        prodBackend["backend: Node<br/>loopback host port"]
        prodMongo["MongoDB<br/>internal network only"]
        prodInit["schema script only"]
    end

    devInit --> devMongo
    devClient --> devBackend --> devMongo
    prodInit --> prodMongo
    prodClient --> prodBackend --> prodMongo
    devMongo --- devData[("development mongo_data")]
    prodMongo --- prodData[("production mongo_data")]
```

Both stacks order services with health checks. Development uses process
liveness for the backend; production uses `GET /api/health/ready`, which
performs a bounded MongoDB ping and briefly caches the generic result. The
production database excludes sample seed data.

## Backend modules

```mermaid
flowchart TB
    server["server.js<br/>Express app, middleware,<br/>error handler, starts server"]

    subgraph routes["routes/"]
        auth["auth.js<br/>/api/auth/*"]
        oauthRoute["oauth.js<br/>/api/auth/:provider"]
        users["users.js<br/>/api/users/*"]
        boards["boards.js<br/>/api/boards/*"]
        admin["admin.js<br/>/api/admin/*"]
    end

    subgraph middleware["middleware/"]
        mw["auth.js<br/>requireAuth (Bearer JWT)"]
        roleMw["requireRole.js<br/>loads user, checks role"]
    end

    subgraph lib["lib/"]
        tokens["tokens.js<br/>JWT sign/verify,<br/>one-time tokens + SHA-256"]
        email["email.js<br/>nodemailer or log"]
        oauthLib["oauth.js<br/>GitHub, Google providers"]
        roles["roles.js<br/>ranks, canManage,<br/>assignableRoles"]
        stats["stats.js<br/>recompute board<br/>and user stats"]
        bootstrap["bootstrapAdmins.js<br/>SITE_ADMIN_EMAILS"]
    end

    setRole["scripts/set-role.js<br/>npm run set-role"]

    subgraph models["models/"]
        User
        Board
        BoardAttempt
    end

    server --> auth & oauthRoute & users & boards & admin
    server -->|"on start"| bootstrap
    admin --> mw & roleMw
    admin --> roles & stats & User & BoardAttempt
    admin -->|"shared validation,<br/>issuePasswordReset"| auth
    roleMw --> roles & User
    stats --> Board & User & BoardAttempt
    auth & oauthRoute -->|"roleForEmail"| bootstrap
    bootstrap --> User
    setRole --> roles & User
    oauthRoute --> oauthLib & tokens & User
    users --> mw
    boards --> mw
    mw --> tokens
    auth --> tokens
    auth --> email
    auth --> User
    users --> User & BoardAttempt
    boards --> User & Board & BoardAttempt
```

## Continuous integration and deployment

```mermaid
flowchart LR
    dev["Developer"] -->|"push / pull request"| gh["GitHub<br/>Skatboards/COP4331-MERN-Project"]
    gh --> quality["quality job<br/>client + backend:<br/>npm ci, lint, build, test"]
    quality --> composeJob["compose job<br/>sequential Buildx builds<br/>production smoke checks"]
    composeJob -->|"push to main only"| deploy["deploy job<br/>(environment: production)"]
    deploy -->|"protected env + exact SHA over SSH"| droplet["Droplet<br/>sequential image builds<br/>up --no-build --wait"]
    droplet --> check["GitHub runner<br/>public HTTPS routes,<br/>liveness + readiness"]
    check -->|pass| finalize["record release<br/>prune stale cache"]
    check -->|fail| rollback["restore previous SHA images<br/>and matching environment"]
```

The backend tests use an in-memory MongoDB. CI builds Docker images in explicit
sequential steps with separate Buildx cache scopes. Pull requests stop after
quality and Compose verification. A successful push deploys the exact commit
tested by that run, transfers a mode-`0600` release-specific environment, and
retains the previous successful images and configuration until public checks
pass. `DROPLET_USER` and `DROPLET_APP_PATH` are GitHub environment secrets.
