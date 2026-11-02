# System design

Sweeple is a MERN app: a React client, an Express API, and MongoDB, each in its own container from [compose.yaml](../compose.yaml). The same Compose stack runs locally and on the DigitalOcean droplet.

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
            client["client<br/>Vite dev server<br/>127.0.0.1:5173"]
            backend["backend<br/>Express 5 + Mongoose<br/>127.0.0.1:3001 to :3000"]
            mongo[("mongo<br/>MongoDB 7.0<br/>127.0.0.1:27017")]
            vol[("mongo_data<br/>volume")]
        end
    end

    smtp["SMTP email provider"]
    inbox["User's inbox"]

    browser -->|HTTPS| cf
    mobile -->|HTTPS JSON| cf
    swagger -->|HTTPS JSON| cf
    cf --> nginx
    nginx -->|"proxy (after switch-site.sh new)"| client
    client -->|"/api/* proxy"| backend
    backend -->|Mongoose| mongo
    mongo --- vol
    backend -->|"verification and reset emails"| smtp
    smtp --> inbox
```

- Only nginx is reachable from the internet. The containers listen on `127.0.0.1`.
- The Vite server serves the React app and forwards every `/api/*` request to the `backend` service, so the browser only ever talks to one origin.
- nginx still sends the domain to the older pm2 app until `deploy/switch-site.sh new` is run (see [deploy/README.md](../deploy/README.md)).
- Without `SMTP_HOST`, the backend prints emails to its log instead of sending them.

## Containers

```mermaid
flowchart TB
    subgraph compose["compose.yaml"]
        client["client<br/>build: ./client<br/>port CLIENT_PORT to 5173<br/>bind mount ./client"]
        backend["backend<br/>build: ./backend<br/>port BACKEND_PORT to 3000<br/>bind mount ./backend"]
        mongo["mongo<br/>image: mongo:7.0.45<br/>port 127.0.0.1:MONGO_PORT to 27017"]
        init["./mongo/init<br/>01-create-schema.js<br/>02-seed-data.js"]
        data[("mongo_data")]
    end

    client -->|"depends_on: healthy"| backend
    backend -->|"depends_on: healthy"| mongo
    init -->|"runs once on an empty volume"| mongo
    mongo --- data
```

Each service has a health check (`GET /` for the client, `GET /api/health` for the backend, a `ping` for MongoDB), and Compose starts them in order once the one before is healthy.

## Backend modules

```mermaid
flowchart TB
    server["server.js<br/>Express app, middleware,<br/>error handler, starts server"]

    subgraph routes["routes/"]
        auth["auth.js<br/>/api/auth/*"]
        users["users.js<br/>/api/users/*"]
        boards["boards.js<br/>/api/boards/*"]
    end

    mw["middleware/auth.js<br/>requireAuth (Bearer JWT)"]

    subgraph lib["lib/"]
        tokens["tokens.js<br/>JWT sign/verify,<br/>one-time tokens + SHA-256"]
        email["email.js<br/>nodemailer or log"]
    end

    subgraph models["models/"]
        User
        Board
        BoardAttempt
    end

    server --> auth & users & boards
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
    quality --> composeJob["compose job<br/>docker compose up --wait<br/>curl health checks"]
    composeJob -->|"push to main only"| deploy["deploy job<br/>(environment: production)"]
    deploy -->|SSH| droplet["Droplet<br/>git reset --hard origin/main<br/>docker compose up -d --build -V"]
    droplet --> check["curl 127.0.0.1:5173/api/health"]
```

The backend `test` step runs the API tests against an in-memory MongoDB, so it needs no database service. Pull requests run the first two jobs only.
