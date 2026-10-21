# Icinga Monitoring

This document describes how Icinga health check monitoring is configured for apps deployed from the labs-app-template.

## Overview

Each deployed environment (staging, production) gets an HTTP health check registered in [Icinga Director](https://mon11.muc.domeus.com/icingaweb2/). The check monitors the app's `/api/health` endpoint and alerts via the `slack-service-mapp-aws-labs` Slack notification channel.

## Service Naming Convention

| Environment | Object Name | URL Monitored |
|-------------|-------------|---------------|
| Staging | `http_stg-{appName}.labs.mapp.com` | `https://stg-{appName}.labs.mapp.com:443/api/health` |
| Production | `http_{appName}.labs.mapp.com` | `https://{appName}.labs.mapp.com:443/api/health` |

## Prerequisites

### Network Access

The Icinga Director API at `mon11.muc.domeus.com` is only accessible from the Mapp VPN or office network. You must be connected before running monitoring commands.

### Admin Activation Required

After a service is created in Icinga Director, it must be **verified and deployed by an Icinga2 Admin** before it becomes active. The service will appear in the Director but will not start monitoring until the configuration is deployed.

### API Credentials

The monitoring script uses a limited-capability Icinga Director API account (`ApiMappAwsLab`) that is embedded in the script. This account can only create and delete service definitions — it cannot modify the Icinga host configuration, deploy changes, or perform any other administrative actions.

## Usage

### Automatic (via Infrastructure Deploy/Destroy)

Monitoring is automatically managed when you deploy or destroy infrastructure:

- `make staging-infra-deploy` — after CDK deploy succeeds, registers the staging health check in Icinga
- `make staging-infra-destroy` — before CDK destroy runs, removes the staging health check from Icinga
- `make prod-infra-deploy` — same for production

If the Icinga API is unreachable (e.g., not on VPN), the monitoring step fails non-fatally and infrastructure deployment still succeeds.

### Manual

You can also manage monitoring independently:

```bash
# Add monitoring
make staging-monitoring-add
make prod-monitoring-add

# Remove monitoring
make staging-monitoring-remove
make prod-monitoring-remove
```

Or call the script directly:

```bash
./scripts/deploy/icinga-monitoring.sh add staging
./scripts/deploy/icinga-monitoring.sh remove production
```

### Idempotency

- **Adding**: If the service already exists in Icinga, the script prints a message and exits successfully without creating a duplicate.
- **Removing**: If the service does not exist in Icinga, the script prints a message and exits successfully.

This means you can safely run `make staging-infra-deploy` multiple times without creating duplicate services.

## Viewing Services in Icinga

### Web Interface

View a service in the Icinga web UI:

- **Staging**: `https://mon11.muc.domeus.com/icingaweb2/monitoring/service/show?host=monsat11.muc.domeus.com&service=http_stg-{appName}.labs.mapp.com`
- **Production**: `https://mon11.muc.domeus.com/icingaweb2/monitoring/service/show?host=monsat11.muc.domeus.com&service=http_{appName}.labs.mapp.com`

**Login**: `guest` / `guest` (read-only access)

### Notification Channel

All alerts go to: `slack-service-mapp-aws-labs`

## Service Check Details

Each service is configured with:

| Parameter | Value |
|-----------|-------|
| Check Command | `check_http` |
| Imports | `IST VM` |
| Object Type | `apply` |
| Assign Filter | `host.name="monsat11.muc.domeus.com"` |
| SSL | `true` |
| Port | `443` |
| URI | `https://{domain}:443/api/health` |
| Expected Response | `200` |
| Notification | `slack-service-mapp-aws-labs` |

The health endpoint returns:

```json
{
  "status": "healthy",
  "version": "1.2.0",
  "commit": "abc1234",
  "environment": "staging",
  "timestamp": "2026-02-23T12:00:00.000Z"
}
```

## Adding Additional Service Monitoring

To monitor additional endpoints or services beyond the default HTTP health check, create a new script following the same pattern as `scripts/deploy/icinga-monitoring.sh`. The general approach:

### 1. Define Service Parameters

Choose a unique `object_name`, set the appropriate `check_command`, and configure the `vars` for that check type.

**Naming convention**: `{check_type}_{domain_or_resource}` (e.g., `http_stg-myapp.labs.mapp.com`, `tcp_stg-myapp-db.labs.mapp.com_5432`)

### 2. Use the Icinga Director REST API

| Operation | Method | Endpoint |
|-----------|--------|----------|
| Create | `POST` | `https://mon11.muc.domeus.com/icingaweb2/director/service` |
| Check existence | `GET` | `https://mon11.muc.domeus.com/icingaweb2/director/service?name={object_name}` |
| Delete | `DELETE` | `https://mon11.muc.domeus.com/icingaweb2/director/service?name={object_name}` |

All requests require Basic Auth with the Icinga API credentials (see `scripts/deploy/icinga-monitoring.sh` for the account details).

### 3. Example: TCP Port Check

```json
{
  "assign_filter": "host.name=%22monsat11.muc.domeus.com%22",
  "check_command": "check_tcp",
  "imports": ["IST VM"],
  "object_name": "tcp_stg-myapp-db_5432",
  "object_type": "apply",
  "notes": "TCP port check for myapp staging database",
  "vars": {
    "tcp_address": "stg-myapp-db-endpoint.rds.amazonaws.com",
    "tcp_port": "5432"
  }
}
```

### 4. Register and Activate

After creating the service via the API, request an Icinga2 Admin to deploy the configuration. The service will not be active until this is done.

## Troubleshooting

### Service created but not monitoring

The service exists in Icinga Director but has not been deployed. Contact an Icinga2 Admin to deploy the configuration.

### curl errors or connection refused

The Icinga Director API is at `https://mon11.muc.domeus.com/icingaweb2/director/`. Verify:
- You are on the Mapp VPN or office network
- The credentials are correct
- The Icinga server is reachable

### Service already exists

This is normal — the script is idempotent. If you need to update the service configuration, remove it first, then re-add:

```bash
make staging-monitoring-remove
make staging-monitoring-add
```
