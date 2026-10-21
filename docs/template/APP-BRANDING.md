# App branding

The sidebar, mobile header, top navigation, company-customer header, admin login,
signing-out screen, and browser metadata (including per-page titles) identify the
current app. The Mapp logo and environment badge remain separate from the app
identity.

## Name

Set `displayName` in `app.config.json` (the setup script already prompts for it):

```json
{
  "appName": "sales-coach",
  "displayName": "Sales Coach",
  "logoPath": "/img/sales-coach.svg"
}
```

These are fields to merge into the existing config, not a replacement config.
The display name resolves on the server in this order:

1. Nonblank `APP_DISPLAY_NAME`, if set.
2. Nonblank `APP_NAME`, when it differs from the resource slug in `app.config.json`.
3. `app.config.json` → `displayName`.
4. `APP_NAME`, then `Mapp Labs`.

ECS sets `APP_NAME` to the resource/billing slug, so deployed apps normally use
`displayName`. Do not change the slug to change the visible name. Only the
resolved name and logo path are passed to the browser, not the full config.
Configuration changes require a rebuild/redeploy (restart the local dev server
for environment changes).

## Optional logo

Add an app-owned SVG, PNG, or WebP file under `public/img/` and set `logoPath` to
its root-relative path, such as `/img/sales-coach.svg`. A transparent, square icon
works best; it is contained in a 32px square alongside the name. Leave `logoPath`
empty for text only. A missing/broken image falls back to text (initials in the
collapsed sidebar). Remote URLs are not supported.

This is a deployment-time asset option, not an in-app upload/settings screen.
No database, S3 setup, or new credentials are required.

## Existing apps

Template changes do not automatically update existing forks. Bring over the
branding resolver, shared branding components, root provider, and layout changes,
then configure each app's display name and optional logo. Review custom layouts
when applying the changes. New clones get the behavior from the template.

An agent-runnable prompt for this is at
[`docs/retrofit/2026-09-22-app-branding.md`](../retrofit/2026-09-22-app-branding.md).
