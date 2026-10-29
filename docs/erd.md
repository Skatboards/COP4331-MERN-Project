# Entity relationship diagram

The `GameDB` database has three collections. They are defined by the Mongoose models in [backend/models/](../backend/models/) and created, with their indexes, by [mongo/init/01-create-schema.js](../mongo/init/01-create-schema.js).

```mermaid
erDiagram
    USER ||--o{ BOARD_ATTEMPT : "plays"
    BOARD ||--o{ BOARD_ATTEMPT : "is played in"

    USER {
        ObjectId _id PK
        string firstName
        string lastName
        string username UK "3-20 letters, numbers, _"
        string email UK "stored lowercase"
        string passwordHash "bcrypt, never returned"
        boolean emailVerified "default false"
        string emailVerificationTokenHash "SHA-256, nullable"
        date emailVerificationExpires "nullable"
        string passwordResetTokenHash "SHA-256, nullable"
        date passwordResetExpires "nullable"
        number totalClicks "default 0"
        number boardsCompleted "default 0"
        number efficiency "0-100, average of won games"
        date createdAt
        date updatedAt
    }

    BOARD {
        ObjectId _id PK
        string seed UK "e.g. daily-2026-10-20"
        number totalAttempts "default 0"
        number totalCompletions "default 0"
        number globalCompletionPercentage "0-100"
        number averageClicks
        number averageEfficiency "0-100, won games only"
        date createdAt
        date updatedAt
    }

    BOARD_ATTEMPT {
        ObjectId _id PK
        ObjectId userId FK "references USER"
        ObjectId boardId FK "references BOARD"
        number clicks "default 0"
        boolean completed "true when won"
        number efficiency "0-100, 0 when lost"
        string status "in_progress, won, lost"
        date completedAt "nullable"
        date createdAt
        date updatedAt
    }
```

## Relationships and rules

| Relationship | Meaning |
| --- | --- |
| User to BoardAttempt | One user has zero or more attempts. |
| Board to BoardAttempt | One board has zero or more attempts. |
| User and Board, through BoardAttempt | Many to many. A unique index on (`userId`, `boardId`) allows one attempt per user per board. |

## Indexes

| Collection | Index | Type |
| --- | --- | --- |
| `users` | `username` | unique |
| `users` | `email` | unique |
| `boards` | `seed` | unique |
| `boardAttempts` | `userId` + `boardId` | unique, compound |

## Derived fields

The stats on `users` and `boards` are kept up to date when a game is recorded (`POST /api/boards/:seed/attempts`), rather than computed on each read:

- `boards.totalAttempts`, `totalCompletions`, `globalCompletionPercentage`, `averageClicks`, and `averageEfficiency` summarize that board's attempts.
- `users.totalClicks`, `boardsCompleted`, and `efficiency` summarize that user's attempts.

The fields holding password and token hashes are excluded from queries by default (`select: false`) and are never sent to clients.
