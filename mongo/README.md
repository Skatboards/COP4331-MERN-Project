# MongoDB initialization

Compose mounts `mongo/init/` at `/docker-entrypoint-initdb.d`. The official MongoDB image runs those files in alphabetical order, once, when it starts with a new, empty data volume:

1. `01-create-schema.js` creates the `users`, `boards`, and `boardAttempts` collections in `GameDB` and their unique indexes (`users.username`, `users.email`, `boards.seed`, and `boardAttempts` on `userId` + `boardId`).
2. `02-seed-data.js` inserts sample users, boards, and board attempts if they do not already exist.

The sample users' `passwordHash` values are placeholders (`DEMO_HASH_NOT_FOR_LOGIN`); they are fixture data, not usable logins. Authentication code should reject them.

The Mongoose models in `backend/models/` describe the same collections. When you change a field or index, update the model and `01-create-schema.js` together.

## Local development

Start MongoDB from the repository root:

```bash
cp .env.example .env
docker compose up -d mongo
```

The scripts only run automatically on an empty `mongo_data` volume. To rerun them from scratch:

```bash
docker compose down -v
docker compose up -d mongo
```

The `-v` option permanently deletes the development database volume. Do not use it when the data must be preserved. A volume created by a different MongoDB major version (for example 8.0) must also be reset this way before it can start on 7.0.

Both scripts are idempotent, so they can also be run manually inside the container:

```bash
docker compose exec mongo mongosh --file /docker-entrypoint-initdb.d/01-create-schema.js
docker compose exec mongo mongosh --file /docker-entrypoint-initdb.d/02-seed-data.js
```

On Git Bash for Windows, prefix those commands with `MSYS_NO_PATHCONV=1` so the container path is not rewritten.
