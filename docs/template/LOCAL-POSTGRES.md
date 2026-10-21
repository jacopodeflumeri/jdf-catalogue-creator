# Local PostgreSQL

Local development and the database tests need a PostgreSQL server plus the
`psql` and `createdb` client tools on your `PATH` (`make dev-check-prerequisites`
checks for both). Deployed environments run PostgreSQL 17 on RDS; use 17 locally
to match (any recent version works for most development).

The template's defaults assume user **`postgres`** with password **`localdev`** on
`localhost:5432`:

- `.env` (from `.env.example`): `DB_USER=postgres`, `DB_PASSWORD=localdev`,
  `DB_NAME={dbName}` — `DATABASE_URL` is built from these unless you set it.
- `make dev-test`: `TEST_DB_USER=postgres`, `TEST_DB_PASSWORD=localdev`, database
  `{appName}_test` (created automatically). Override on the command line, e.g.
  `make dev-test TEST_DB_PASSWORD=...`.

Setting the `postgres` password to `localdev` locally saves you editing either.

## macOS (Homebrew)

```bash
brew install postgresql@17
brew services start postgresql@17
# postgresql@17 is keg-only: put its tools on PATH (zsh)
echo 'export PATH="$(brew --prefix postgresql@17)/bin:$PATH"' >> ~/.zshrc && source ~/.zshrc
```

Homebrew creates a superuser named after your macOS account, not `postgres`.
Create the role the template expects:

```bash
psql -d postgres -c "CREATE ROLE postgres WITH LOGIN SUPERUSER PASSWORD 'localdev';"
```

(Or keep your own role and set `DB_USER`/`DB_PASSWORD` in `.env` and
`TEST_DB_USER`/`TEST_DB_PASSWORD` when running tests.)

[Postgres.app](https://postgresapp.com/) works too; add its `bin` directory to
`PATH` as its docs describe.

## Linux (Debian/Ubuntu)

```bash
sudo apt-get install postgresql postgresql-client
sudo systemctl enable --now postgresql
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'localdev';"
```

Connections to `localhost` use password authentication by default on
Debian/Ubuntu, so the password above is what `.env` needs. Other distributions:
install the `postgresql` server and client packages and set the `postgres`
password the same way.

## Windows

Use the EDB installer and work from **Git Bash** (see [WINDOWS.md](WINDOWS.md) —
the Makefile and scripts need it).

1. Download the installer from https://www.postgresql.org/download/windows/
   (PostgreSQL 17, Windows x86-64).
2. Run it and keep the defaults:
   - Installation directory `C:\Program Files\PostgreSQL\17\`
   - Components: PostgreSQL Server, pgAdmin 4, **Command Line Tools** (needed);
     Stack Builder is optional — skip launching it at the end
   - Port `5432`
   - **Superuser password**: set it to `localdev` to match the template defaults
     (or remember what you chose and put it in `.env`).
3. **Add the client tools to `PATH`.** The installer doesn't, so `psql` and
   `createdb` are "command not found" in Git Bash. Add
   `C:\Program Files\PostgreSQL\17\bin` to your user `Path`
   (Start → "Edit environment variables for your account" → Path → New), then
   **open a new Git Bash window**. For the current window only:
   ```bash
   export PATH="$PATH:/c/Program Files/PostgreSQL/17/bin"
   ```
4. Verify:
   ```bash
   psql --version
   PGPASSWORD=localdev psql -h localhost -U postgres -c 'select 1'
   ```

The server runs as a Windows service (`postgresql-x64-17`) and starts with
Windows. Manage it from PowerShell:

```powershell
Get-Service -Name postgresql*            # status
Restart-Service -Name postgresql-x64-17  # also Start-/Stop-Service
```

or from Services (`services.msc`), where you can set the startup type to Manual
if you don't want it running all the time.

pgAdmin 4 (Start menu) is a GUI for browsing databases and running queries.

## Create the app database

With the server running:

```bash
createdb -h localhost -U postgres {dbName}   # the DB name you chose in setup.sh
make dev-initial-setup                       # installs deps, migrates, seeds
```

(`PGPASSWORD=localdev createdb ...` avoids the password prompt.) You don't
create the test database yourself — `make dev-test` does.

## Common tasks

```bash
psql -h localhost -U postgres -d {dbName}     # \l databases, \dt tables, \d table, \q quit

# Backup / restore
pg_dump -h localhost -U postgres -d {dbName} -F c -f {dbName}.dump
pg_restore -h localhost -U postgres -d {dbName} -F c {dbName}.dump

make dev-db-reset        # drop + migrate + seed the LOCAL database
make dev-db-studio       # Prisma Studio
```

## Troubleshooting

**`psql: command not found` / `createdb: command not found`** — the client tools
aren't on `PATH`: see the macOS `PATH` line or Windows step 3. Open a new
terminal afterwards.

**Port 5432 already in use** — another Postgres (or a Docker container) holds it.
macOS/Linux: `lsof -nP -iTCP:5432 -sTCP:LISTEN`. Windows (PowerShell):
`netstat -ano | findstr :5432`, then stop that process or service. Or run on
another port and set `DB_PORT` / `TEST_DB_PORT`.

**`password authentication failed for user "postgres"`** — the password in `.env`
(and `TEST_DB_PASSWORD` for tests) doesn't match the server's. Reset it:
`psql -U postgres -c "ALTER USER postgres PASSWORD 'localdev';"` (Linux:
`sudo -u postgres psql -c ...`).

**`role "postgres" does not exist`** (macOS Homebrew) — create it as shown above.

**Can't connect at all** — check the service is running (`brew services list`,
`systemctl status postgresql`, or `Get-Service -Name postgresql*`) and that
`DB_HOST`/`DB_PORT` match.
