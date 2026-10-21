# Troubleshooting

Common problems with local setup and deploys that aren't specific to one
feature. Login problems are in [KEYCLOAK.md → Troubleshooting](KEYCLOAK.md#troubleshooting);
deploy and ECS problems in [DEPLOYMENT.md](DEPLOYMENT.md); Windows-specific ones in
[WINDOWS.md](WINDOWS.md).

## npm and the lockfile

### `package-lock.json` gains `nexus.internal.mapp.tools` URLs and the Docker build fails

Your `~/.npmrc` points at the corporate npm mirror, so `npm install` rewrites the
lockfile's `resolved` URLs to it. The Docker build (`npm ci`) runs without that
mirror's CA and fails with `UNABLE_TO_GET_ISSUER_CERT_LOCALLY`. The lockfile is
committed, so check before committing or deploying:

```bash
grep -c 'nexus.internal.mapp.tools' package-lock.json   # must print 0
```

If it's non-zero, regenerate against the public registry and commit:

```bash
rm package-lock.json
npm install --registry=https://registry.npmjs.org/
```

### `npm install` fails with `ETARGET No matching version found for ...`

Same cause: the corporate mirror doesn't carry every version. Override the
registry for that install:

```bash
npm install --registry=https://registry.npmjs.org/
```

Once the lockfile resolves against the public registry, later `npm install` /
`npm ci` runs work normally.

## Local database

### `make dev-db-seed` fails with `TableDoesNotExist` although migrations ran

Old forks only: `prisma/seed.ts` used to require `DATABASE_URL` while
`.env.example` leaves it commented out (it is built from `DB_*`). The template's
seed now builds it the same way as `prisma.config.ts`. Pull that fix, or set
`DATABASE_URL` explicitly in `.env`.

### `make dev-test` can't connect to the test database

The test targets default to `postgres` / `localdev` on `localhost:5432` and a
database named `{appName}_test`. If your local Postgres uses another password,
pass it through: `make dev-test TEST_DB_PASSWORD=...` (also `TEST_DB_USER`,
`TEST_DB_HOST`, `TEST_DB_PORT`). Installing Postgres: [LOCAL-POSTGRES.md](LOCAL-POSTGRES.md).

### Auth redirects 404 locally

`NEXTAUTH_URL` doesn't match the port the dev server actually bound to (Next.js
falls back to 3001/3002 when 3000 is busy). Fix `NEXTAUTH_URL` (and `APP_URL`) or free
port 3000.

## AWS CLI

### `Symbol not found: _XML_SetAllocTrackerActivationThreshold` (macOS)

Homebrew Python 3.14 broke the Homebrew AWS CLI's expat linkage. The deploy
scripts work around it themselves (`scripts/deploy/_config.sh` sets
`DYLD_LIBRARY_PATH`); for `aws` commands you run by hand, prefix them:

```bash
DYLD_LIBRARY_PATH=/opt/homebrew/opt/expat/lib aws ...
```

or put an alias in `~/.zshrc`.

### `The security token included in the request is expired`

The 12-hour SSO session ran out. Run `aws sso login --profile labs-power`, or
`./scripts/refresh-labs-aws-creds.sh` (which also refreshes the static
`[labs-power]` credentials some tools read).
