# Mapp Internal Root CA

Every internal Mapp HTTPS service we call — `company-management-service.k8s-prod-01.nbg.webtrekk.com`,
`product-feed-service.…muc.domeus.com`, internal Keycloak, and others — presents a
TLS ingress certificate that chains to a **single self-signed root**:

```
CN = ca.internal.mapp.tools
O  = Mapp Digital, OU = INFRA
Valid until 2034-03-14
```

This root is **public and non-secret**. Apps that don't trust it fail with
`UNABLE_TO_GET_ISSUER_CERT_LOCALLY` against any internal service.

## How the template trusts it

Rather than have each app invent its own `*_CA_PEM` SSM secret per service, the
template **vendors the root in the image** and trusts it at the container layer:

1. **Vendored cert** — `certs/ca.internal.mapp.tools.crt`. It uses a `.crt`
   extension on purpose: the repo `.gitignore` ignores `*.pem`, so a `.pem` file
   would silently never be committed. Source of truth:
   `mapp-digital/devops-kube-ansible` → `roles/ca_certs/files/ca.internal.mapp.tools.crt`.

2. **System trust store** (`Dockerfile`, runner stage) — `ca-certificates` +
   `openssl` are installed, the cert is copied to
   `/usr/local/share/ca-certificates/`, and `update-ca-certificates` folds it into
   the OS trust store. This covers non-Node tooling (curl, openssl, etc.).

3. **Node trust** (`scripts/docker-entrypoint.sh`) — Node does not read the OS
   trust store for `https`, so the entrypoint builds a single
   `NODE_EXTRA_CA_CERTS` bundle (`/tmp/internal-ca-bundle.pem`) that **always**
   contains the vendored root and **additively** appends `KEYCLOAK_CA_PEM` when
   set. `NODE_EXTRA_CA_CERTS` *adds to* the default Mozilla roots, so public-CA
   chains keep working. `src/modules/auth/config/nextauth.ts` further merges this
   bundle with `tls.rootCertificates` for the Keycloak backchannel agent.

The result: any app scaffolded from this template can call internal Mapp HTTPS
services with **no per-app and no per-service configuration**.

## What you do NOT need to do

- **Do not** create a `*_CA_PEM` SSM parameter for internal services
  (company-management-service, product-feed-service, …). Their root is already
  trusted in the image.
- **Do not** set `rejectUnauthorized: false` / `*_TLS_INSECURE` for internal
  services. That bypass is only an emergency transitional state, never the answer
  for a cert that already chains to `ca.internal.mapp.tools`.

## When `KEYCLOAK_CA_PEM` is still needed

`KEYCLOAK_CA_PEM` remains the right tool for **one edge case only**: a Keycloak
host whose certificate is **NOT** under the internal root (e.g. a third-party IdP,
or a public CA chain that ships an incomplete intermediate set). In that case use
`make <env>-keycloak-ca-update` (see [KEYCLOAK.md](./KEYCLOAK.md)) —
it stores only the missing intermediate(s) in SSM, and the entrypoint appends them
to the bundle alongside the vendored internal root.

## Rotating the root

The current root is valid until 2034. If/when it rotates, re-copy the canonical
cert from `mapp-digital/devops-kube-ansible`
(`roles/ca_certs/files/ca.internal.mapp.tools.crt`) over
`certs/ca.internal.mapp.tools.crt`, rebuild, and redeploy. Verify it is a
self-signed root before committing:

```bash
openssl x509 -in certs/ca.internal.mapp.tools.crt -noout -subject -issuer
# subject and issuer must be identical (CN=ca.internal.mapp.tools)
```
