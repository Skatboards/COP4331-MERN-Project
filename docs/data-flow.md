# Data flow

How data moves through the app for each main feature. Every request from the browser goes to the Vite server, which forwards `/api/*` to the backend; the diagrams show that hop as "Client". The mobile app and SwaggerHub call the same endpoints directly.

The endpoints are described in full in [backend/openapi.yaml](../backend/openapi.yaml).

## Overview

```mermaid
flowchart LR
    user(["Player"])
    ui["React client"]
    api["Express API"]
    db[("MongoDB<br/>GameDB")]
    mail["Email"]

    user -->|"sign up, log in,<br/>play, browse"| ui
    ui -->|"JSON requests<br/>+ Bearer token"| api
    api -->|"JSON responses"| ui
    api <-->|"users, boards,<br/>boardAttempts"| db
    api -->|"verification and<br/>reset links"| mail
    mail -->|"click link"| api
```

## Sign up and email verification

```mermaid
sequenceDiagram
    autonumber
    actor P as Player
    participant C as Client
    participant A as API
    participant D as MongoDB
    participant M as Email

    P->>C: Fill in the sign-up form
    C->>A: POST /api/auth/register
    A->>A: Validate username, email, password
    A->>D: Find user with that username or email
    alt Already taken
        A-->>C: 409 Username or email in use
    else Free
        A->>A: bcrypt hash the password, make a random token
        A->>D: Insert user (emailVerified false, SHA-256 of token, expiry 24 h)
        A->>M: Send link /api/auth/verify-email?token=...
        A-->>C: 201 Account created
    end

    P->>A: Click the link in the email
    A->>D: Find user by token hash, not expired
    alt Token valid
        A->>D: Set emailVerified true, clear token
        A-->>P: 302 redirect to /?verified=1
    else Unknown or expired
        A-->>P: 302 redirect to /?verified=0
    end
```

`POST /api/auth/resend-verification` replaces the token and sends a new link. It answers the same way whether or not the email is registered.

## Log in and authenticated requests

```mermaid
sequenceDiagram
    autonumber
    actor P as Player
    participant C as Client
    participant A as API
    participant D as MongoDB

    P->>C: Enter username or email and password
    C->>A: POST /api/auth/login
    A->>D: Find user (with passwordHash)
    A->>A: bcrypt compare (against a dummy hash if no user)
    alt Wrong password or no such user
        A-->>C: 401 Incorrect username or password
    else Email not verified
        A-->>C: 403 EMAIL_NOT_VERIFIED
    else OK
        A->>A: Sign JWT (sub = user id, expires in 1 day)
        A-->>C: 200 token + profile
        C->>C: Keep the token
    end

    C->>A: GET /api/users/me with Authorization Bearer token
    A->>A: requireAuth verifies the JWT and sets req.userId
    A->>D: Find user by id
    A-->>C: 200 profile and stats
```

## Recording a game

```mermaid
sequenceDiagram
    autonumber
    actor P as Player
    participant C as Client
    participant A as API
    participant D as MongoDB

    P->>C: Finish the daily board
    C->>A: POST /api/boards/daily-2026-10-20/attempts with clicks, status, efficiency
    A->>A: requireAuth, validate the game data
    A->>D: Find the board, or create it (upsert)
    A->>D: Insert boardAttempt (unique per user and board)
    alt Already played this board
        D-->>A: Duplicate key error
        A-->>C: 409 Already played
    else First game on this board
        A->>D: Update board stats in one step (attempts, completions, averages)
        A->>D: Update user totals in one step (clicks, boards completed, efficiency)
        A-->>C: 201 attempt + updated board stats
    end
```

The stats updates are MongoDB update pipelines that read the old values and write the new ones in a single operation, so two games finishing at the same moment cannot overwrite each other's totals. Efficiency averages only count games that were won.

## Password reset

```mermaid
sequenceDiagram
    autonumber
    actor P as Player
    participant C as Client
    participant A as API
    participant D as MongoDB
    participant M as Email

    P->>C: Forgot password, enter email
    C->>A: POST /api/auth/forgot-password
    opt Email belongs to an account
        A->>D: Store SHA-256 of a new token, expiry 1 h
        A->>M: Send link /reset-password?token=...
    end
    A-->>C: 200 If that email belongs to an account...

    P->>C: Open the link, enter a new password
    C->>A: POST /api/auth/reset-password with token and password
    A->>D: Find user by token hash, not expired, and set new bcrypt hash
    alt Token valid
        A->>D: Clear the token (one use only)
        A-->>C: 200 Password updated
    else Unknown or expired
        A-->>C: 400 Reset link is invalid or has expired
    end
```

## Reading stats

```mermaid
flowchart LR
    subgraph Public["No login needed"]
        lb["GET /api/users/leaderboard"]
        search["GET /api/users/search?q="]
        list["GET /api/boards"]
        board["GET /api/boards/:seed"]
        top["GET /api/boards/:seed/attempts"]
    end
    subgraph Private["Login needed"]
        me["GET /api/users/me"]
        mine["GET /api/users/me/attempts"]
    end

    users[("users")]
    boards[("boards")]
    attempts[("boardAttempts")]

    lb --> users
    search --> users
    me --> users
    list --> boards
    board --> boards
    top --> boards
    top --> attempts
    top -.->|"username"| users
    mine --> attempts
    mine -.->|"seed"| boards
```

Public endpoints never return email addresses or password hashes.
