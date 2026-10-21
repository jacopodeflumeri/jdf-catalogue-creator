# `.retrofit-state.json` — retrofit state tracking

Each app forked from `labs-app-template` keeps a `.retrofit-state.json` at its **repo
root**, recording which retrofits it has applied, against which template version, and
any app-specific decisions. It is **committed** (not gitignored) — external querying is
the whole point.

JSON Schema: [`retrofit-state.schema.json`](retrofit-state.schema.json).

> **Lineage / prior art.** This is the same idea as
> [`copier`](https://copier.readthedocs.io/)'s `.copier-answers.yml` and
> [`cruft`](https://cruft.github.io/cruft/)'s `.cruft.json` (a generated project
> recording which template version it's synced to) crossed with a DB-migration history
> table (Flyway/Prisma/Rails). We don't use copier/cruft directly because their updates
> are *mechanical* (Jinja re-render + 3-way merge); our retrofits are *semantic* and
> forks have diverged, so they're agent-applied with human review. The state file is the
> recognizable, queryable part.

## Why it exists

1. **Fleet visibility.** A dashboard app can scan every Mapp Labs repo, read
   `.retrofit-state.json`, and report which apps are current, which carry divergence
   debt (an applicable retrofit they `skipped`), and which are behind (`pending`).
2. **Resume.** The orchestrator ([START-HERE.md](START-HERE.md)) reads it first to know
   where a previous retrofit left off, instead of re-deriving everything.
3. **Decision record.** When an app intentionally diverges from a retrofit for an
   app-specific reason, that reason is captured in `notes` / `deviations` for the next
   agent (or a human browsing the repo).

## Location & lifecycle

- Path: `<app-repo-root>/.retrofit-state.json`. Created on the first retrofit if absent.
- **Committed** to the app repo.
- Updated by each retrofit prompt's "record state" step, and by the orchestrator after
  each item. The orchestrator reads it at the start of a run.

## Shape (see the schema for the full contract)

```json
{
  "schemaVersion": 1,
  "template": {
    "repo": "mapp-digital/labs-app-template",
    "forkedAtVersion": "1.0.12",
    "forkedAtRef": "v1.0.12",
    "lastRetrofitAgainstVersion": "1.0.24",
    "lastRetrofitAgainstRef": "v1.0.24",
    "lastRetrofitAt": "2026-06-28T14:30:00Z"
  },
  "app": { "name": "myapp" },
  "retrofits": {
    "2026-06-19-app-router-routing-convention": {
      "status": "applied",
      "templateVersion": "1.0.24",
      "templateRef": "v1.0.24",
      "at": "2026-06-28T14:30:00Z",
      "by": "claude-agent",
      "notes": "Ported isNextControlFlowError into the two existing boundaries.",
      "deviations": ["Deferred instrumentation.ts — app is on Next 14, not 15."]
    },
    "2026-06-19-client-catalog-companies-workspaces": {
      "status": "applied",
      "templateVersion": "1.0.24",
      "templateRef": "v1.0.24",
      "capability": "client_catalog",
      "at": "2026-06-28T14:35:00Z",
      "by": "claude-agent",
      "notes": "Hybrid build — prospect app, manual-add path kept; clientCatalogCompanyId nullable."
    },
    "2026-05-14-data-sync": {
      "status": "not-applicable",
      "capability": "data_sync",
      "at": "2026-06-28T14:36:00Z",
      "notes": "No admin-editable config worth syncing between envs."
    }
  }
}
```

### `retrofits` keys (the retrofit id)

Use the **dedicated prompt's filename stem** as the id — e.g.
`2026-06-19-app-router-routing-convention` for
`docs/retrofit/2026-06-19-app-router-routing-convention.md`. For a small MIGRATION entry
that has no dedicated prompt (the LLM ones), use a MIGRATION-derived `YYYY-MM-DD-slug`.

### `status` values

| value | meaning |
|---|---|
| `applied` | fully done |
| `partial` | some sub-changes done / something deferred — explain in `notes`/`deviations` |
| `skipped` | applicable, but the user declined → **divergence debt** |
| `not-applicable` | genuinely doesn't apply to this app |
| `pending` | identified as needed, not yet done |

## How agents update it

Every retrofit prompt ends with a **record-state** step: create `.retrofit-state.json`
if absent (fill `schemaVersion`, `template`, `app`), then upsert this retrofit's entry
under `retrofits[<id>]` with `status`, `templateVersion` + `templateRef` (the version
**and** the exact git tag/SHA you worked against), an ISO-8601 UTC `at`
(`date -u +%Y-%m-%dT%H:%M:%SZ`), `by`, the `capability` id if the retrofit maps to one,
and `notes`/`deviations` for anything that didn't follow the template exactly. Also
refresh `template.lastRetrofitAgainstVersion` / `lastRetrofitAgainstRef` /
`lastRetrofitAt`. Don't remove other entries.

> **Capabilities are referenced, not duplicated.** The `capability` field is a pointer
> to a registry id (`docs/template/capabilities/_registry.json`; `docs/capabilities/` in
> apps not yet on the 2026-10-17 docs layout). The list of which capabilities
> an app actually has **enabled** stays authoritative in `app.config.json`
> (`enabledCapabilities`) — a fleet tool reads both files; it is not copied here.

## How a fleet dashboard queries it

For each app repo: fetch `.retrofit-state.json`. An app is **behind** if a
mandatory/soft-mandatory retrofit is missing or `pending`; carries **divergence debt**
if an applicable retrofit is `skipped`; and is **current** if all
mandatory/soft-mandatory ids are `applied`. `template.lastRetrofitAgainstVersion` vs the
template's latest tag shows how stale the app is. Validate against
`retrofit-state.schema.json`.
