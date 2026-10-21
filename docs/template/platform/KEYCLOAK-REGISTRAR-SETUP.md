# Keycloak registrar service account — one-time platform setup

> **For labs-platform maintainers.** App builders never need this: the
> credentials below already exist, and every app's deploy uses them
> automatically. What the registration step does for an app, and how to
> troubleshoot it, is in [../KEYCLOAK.md](../KEYCLOAK.md#redirect-uri-registration-on-labs-portal).

`scripts/deploy/register-keycloak-uris.sh` runs at the end of every
`make {env}-deploy` / `make {env}-first-deploy` and adds the app's redirect,
post-logout and web-origin URIs to the shared `labs-portal` client. It
authenticates as a dedicated **Keycloak service account** with the narrowest
possible permission (`manage-clients` on the `labs` realm). The credentials live
in shared SSM and never touch an app container.

This page is the one-time setup per environment. Staging values are shown;
production is the same procedure in the production Keycloak, with the
`/labs-prod/kc-registrar/*` prefix and the production admin host as `base-url`
(the VPN-routed admin host, e.g. `auth-admin.deproxy.muc.domeus.com`).

## 1. Create the service-account client in Keycloak

In the INT KC admin (`https://admin.idp-int.shortest-route.com`), switch to the
**`labs` realm**, then:

1. **Clients → Create client**
2. General settings:
   - Client type: **OpenID Connect**
   - Client ID: `labs-portal-registrar`
   - Name: `Labs Portal Registrar (service account)`
3. Capability config:
   - **Client authentication: ON**
   - **Authorization: OFF**
   - Authentication flow: uncheck everything except **Service accounts roles**
4. Login settings: leave defaults, **Save**
5. Open the new client → **Credentials** tab → copy the **Client secret**.
6. **Service account roles** tab → **Assign role** → set the filter to
   **"Filter by clients"** → search **`labs-realm-management`** → tick
   **`manage-clients`** → Assign.
   - `view-clients` is also useful (the script reports a missing `labs-portal`
     client more clearly with it); not strictly required.

## 2. Store the credentials in SSM

```bash
aws ssm put-parameter \
  --name /labs/kc-registrar/client-id \
  --type String \
  --value labs-portal-registrar \
  --region eu-central-1 --profile labs-power

aws ssm put-parameter \
  --name /labs/kc-registrar/client-secret \
  --type SecureString \
  --value '<the secret from step 1.5>' \
  --region eu-central-1 --profile labs-power

aws ssm put-parameter \
  --name /labs/kc-registrar/base-url \
  --type String \
  --value https://admin.idp-int.shortest-route.com \
  --region eu-central-1 --profile labs-power
```

(On macOS with Homebrew Python 3.14, prefix `aws` with
`DYLD_LIBRARY_PATH=/opt/homebrew/opt/expat/lib` if it crashes with
`Symbol not found: _XML_SetAllocTrackerActivationThreshold`.)

## 3. Grant deployers read access

Whoever runs `make {env}-deploy` must be able to read `/labs/kc-registrar/*`
(`/labs-prod/kc-registrar/*` for production). The `labs-power` SSO role already
has wide SSM read access in this account, so no extra policy is needed for it.
For a stricter role, add:

```json
{
  "Effect": "Allow",
  "Action": ["ssm:GetParameter", "ssm:GetParameters"],
  "Resource": "arn:aws:ssm:eu-central-1:936190502406:parameter/labs/kc-registrar/*"
}
```

## 4. Test against any deployed app

From a deployed app's checkout, on Mapp VPN:

```bash
./scripts/deploy/register-keycloak-uris.sh staging
```

Expected:

```
==========================================
Keycloak labs-portal URI registration
==========================================
Environment: staging
App:         keycloak
==========================================
Discovering NEXTAUTH_URL from ECS service keycloak-stg...
  NEXTAUTH_URL: https://stg-keycloak.labs.mapp.com
  Hostname:     stg-keycloak.labs.mapp.com
Reading KC registrar credentials from SSM (/labs/kc-registrar/*)...
Requesting service-account token from https://admin.idp-int.shortest-route.com/realms/labs...
  (no changes — all entries already present for stg-keycloak.labs.mapp.com)
==========================================
Registered URIs for stg-keycloak.labs.mapp.com
==========================================
```

For an app that was never registered you'll see `+ redirect: ...`,
`+ post-logout: ...` and `+ web-origin: ...` lines instead.

## Security notes

- The service account has only `manage-clients` on the `labs` realm. It cannot
  create users, change auth flows or touch the master realm. Worst case if the
  secret leaks: an attacker can rewrite `labs-portal` redirect URIs to phish Labs
  users.
- **Rotate** by regenerating the client secret in KC (labs realm → Clients →
  `labs-portal-registrar` → Credentials) and updating the SSM SecureString.
- App containers never hold these credentials. Only the deploying machine reads
  them, briefly.
- The script touches only the `labs-portal` client in the `labs` realm.

## Platform-side failures

| Symptom an app owner reports | Cause | Fix |
|---|---|---|
| `401 Unauthorized` / `invalid_client` from the token endpoint | Secret in SSM wrong or rotated in KC | Re-copy the secret from KC → `labs-portal-registrar` → Credentials into the SSM SecureString |
| `403 Forbidden` from the clients endpoint | Service account lacks `manage-clients` | labs realm → Clients → `labs-portal-registrar` → Service account roles → assign `labs-realm-management/manage-clients` |
| `client 'labs-portal' not found in realm 'labs'` | Client missing, or no `view-clients` | Check the client exists; grant `view-clients` |
| `/labs/kc-registrar/*` parameters not found | Step 2 not done for that environment | Do step 2 |
