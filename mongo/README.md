# MongoDB initialization

The official MongoDB image runs files in `init/` alphabetically when it creates a new, empty data directory:

1. `01-create-schema.js` creates the `users` collection validator and indexes.
2. `02-seed-data.js` inserts a demo user if it does not already exist.

The demo user's `passwordHash` is deliberately `null`; it is fixture data, not a usable login account. Authentication code should reject users without a valid application-generated password hash.

Start MongoDB from the repository root:

```bash
cp .env.example .env
docker compose up -d mongo
```

Initialization scripts only run automatically when the `mongo_data` volume is empty. During early development, rerun them from scratch with:

```bash
docker compose down -v
docker compose up -d mongo
```

The `-v` option permanently deletes the development database volume. Do not use it when the data must be preserved.

Both scripts are idempotent, so they can also be run manually inside the container:

```bash
docker compose exec mongo sh -c 'mongosh "$MONGO_INITDB_DATABASE" --file /docker-entrypoint-initdb.d/01-create-schema.js'
docker compose exec mongo sh -c 'mongosh "$MONGO_INITDB_DATABASE" --file /docker-entrypoint-initdb.d/02-seed-data.js'
```

