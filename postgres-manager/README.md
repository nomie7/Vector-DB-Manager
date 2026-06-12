# Postgres Manager

A modern, local-first web GUI for administering a PostgreSQL server — create
and drop databases, manage roles and users, grant and revoke permissions,
rotate passwords, and run ad-hoc SQL. Built with Next.js, TypeScript and
`node-postgres`.

> ⚠️ This is an **administration tool for local/trusted use**. It connects with
> a privileged role and can run arbitrary SQL. Do not expose it on a public
> network.

## Features

- **Overview** — server version, connected user (and superuser status), uptime,
  active/total connections, and database/role counts.
- **Databases** — list databases with owner, encoding, size and live connection
  count; create new databases (owner, encoding); drop databases (with optional
  `FORCE` to terminate active sessions on PostgreSQL 13+).
- **Roles & Users** — list roles with their attributes and group memberships;
  create roles with login/superuser/createdb/createrole/replication options;
  toggle attributes inline; manage **group membership**; drop roles.
- **Passwords** — set or **rotate** a role's password, generate a strong random
  password server-side (shown once to copy), and optionally set an expiry date.
- **Permissions** — grant/revoke privileges at every level with toggle grids:
  - _Database_: `CONNECT`, `CREATE`, `TEMPORARY`
  - _Schema_: `USAGE`, `CREATE`, plus a bulk "grant ALL on all tables &
    sequences" action (optionally including future objects via default
    privileges)
  - _Table_: `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES`,
    `TRIGGER`
  - _Extensions_: install (`CREATE EXTENSION`) and drop available extensions
- **Tables & data browser** — browse schemas and tables/views with columns,
  indexes, size and row estimates; page through and sort table data; insert,
  edit and delete rows (for tables with a primary key); export the current page
  to CSV; truncate or drop objects.
- **Sessions** — live `pg_stat_activity` view (user, database, state, wait
  event, query, duration) with auto-refresh and the ability to **cancel a
  running query** or **terminate a backend**.
- **Backup & restore** — download a `pg_dump` of any database (plain SQL or
  custom/compressed format) and restore an uploaded dump via `psql` /
  `pg_restore` (format auto-detected).
- **SQL Console** — run arbitrary SQL against any database and view tabular
  results (⌘/Ctrl+Enter to execute).

## Prerequisites

- Node.js 18+
- A reachable PostgreSQL server and a role with enough privileges (a superuser,
  or at least `CREATEDB`/`CREATEROLE`) to perform the operations you need.
- For the Backup & restore tab, the PostgreSQL client binaries (`pg_dump`,
  `pg_restore`, `psql`) must be on the `PATH` of the machine running this app.

## Setup

1. **Install dependencies**

   ```bash
   cd postgres-manager
   npm install
   ```

2. **Configure the connection** — copy the example env file and edit it:

   ```bash
   cp .env.example .env.local
   ```

   ```env
   PGHOST=localhost
   PGPORT=5432
   PGUSER=postgres
   PGPASSWORD=postgres
   PGDATABASE=postgres
   # or a single connection string (takes precedence):
   # DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres
   # PGSSL=true   # only if your server requires SSL
   ```

3. **Run the dev server**

   ```bash
   npm run dev
   ```

4. Open <http://localhost:3000>.

### Production build

```bash
npm run build
npm start
```

## Configuration

| Variable       | Description                                       | Default     |
| -------------- | ------------------------------------------------- | ----------- |
| `DATABASE_URL` | Full connection string (overrides the `PG*` vars) | –           |
| `PGHOST`       | Server host                                       | `localhost` |
| `PGPORT`       | Server port                                       | `5432`      |
| `PGUSER`       | Login role (should be privileged)                 | `postgres`  |
| `PGPASSWORD`   | Password for `PGUSER`                              | –           |
| `PGDATABASE`   | Maintenance database to connect to                | `postgres`  |
| `PGSSL`        | Set to `true` to enable SSL                       | `false`     |

## Security notes

- Identifiers (database/role names) and string literals (passwords) used in DDL
  are escaped before being interpolated into statements; everything else uses
  bind parameters.
- The SQL console executes whatever you type with the configured privileged
  role — treat it accordingly and keep this app on `localhost`.
- `.env.local` is git-ignored so your credentials are never committed.

## Tech stack

Next.js 15 · React 19 · TypeScript · Tailwind CSS v4 · node-postgres (`pg`).
