# Adding a New Capability

This guide is for developers and AI agents adding a new capability to the template. Follow every step — skipping any will leave the capability partially integrated and harder for others to discover.

## What a Capability Consists Of

A fully integrated capability touches these files:

| File/Location | Purpose |
|---------------|---------|
| `docs/template/capabilities/YOUR_CAPABILITY.md` | Documentation for humans and agents |
| `docs/template/capabilities/_registry.json` | Machine-readable registry entry |
| `src/modules/your_capability/` | Module code (if the capability has client code) |
| `prisma/schema/your_capability.prisma.example` | Database schema fragment (if applicable) |
| `.env.example` | Commented-out env var stubs |
| `scripts/setup.sh` | Add to the interactive capability selector |
| `AGENTS.md` | Add to the capabilities table |
| `docs/template/capabilities/README.md` | Add to the available capabilities table |

## Step-by-Step

### 1. Write the Capability Documentation

Create `docs/template/capabilities/YOUR_CAPABILITY.md` using this structure:

```markdown
# Capability Name

**Type:** Optional (or Standard if always included)
**Module:** `src/modules/your_capability/` (or "None" for external API integrations)
**Dependencies:** list other capability IDs, or "None"

## Overview

What this capability does and why someone would use it.

## Authentication

How auth works (OAuth2, Basic Auth, API key, etc.).

## API Endpoints

Table of available endpoints with methods, paths, and descriptions.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|

## Database Schema Changes

What gets added to Prisma schema. Reference the `.prisma.example` file.

## Module API

Code examples showing how to import and use the module.

## Example Use Cases

Bullet list of concrete scenarios.

## Reference

Links to reference implementations or external docs.
```

Every section matters. Agents use these docs to decide whether to enable a capability and how to wire it up.

### 2. Add to the Registry

Add an entry to `docs/template/capabilities/_registry.json` in the `capabilities` array:

```json
{
  "id": "your_capability",
  "name": "Your Capability",
  "description": "One-line description — agents use this to match user intent to capabilities",
  "type": "optional",
  "requiredEnvVars": ["YOUR_CAP_BASE_URL"],
  "optionalEnvVars": ["YOUR_CAP_API_KEY"],
  "prismaChanges": [
    "Description of each schema change (agents read this to know what to add)"
  ],
  "dependencies": ["other_capability_id"],
  "moduleDir": "src/modules/your_capability",
  "schemaFragment": "prisma/schema/your_capability.prisma.example",
  "docFile": "docs/template/capabilities/YOUR_CAPABILITY.md"
}
```

**Registry fields explained:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier, snake_case. Used in `app.config.json` `enabledCapabilities`. |
| `name` | string | Human-readable name |
| `description` | string | One sentence. Agents match user intent against this. Be specific. |
| `type` | `"optional"` or `"standard"` | Standard capabilities are always present (like audit_log). |
| `requiredEnvVars` | string[] | Env vars that must be set for the capability to work. |
| `optionalEnvVars` | string[] | Env vars that enhance but aren't required. |
| `prismaChanges` | string[] | Human-readable descriptions of each schema addition. |
| `dependencies` | string[] | IDs of capabilities that must be enabled first. |
| `moduleDir` | string or null | Path to the module directory. Null if no local module (e.g., external API). |
| `schemaFragment` | string or undefined | Path to the `.prisma.example` file. |
| `swaggerUrl` | string or undefined | Swagger UI path (for external APIs). |
| `openapiSpecUrl` | string or undefined | OpenAPI spec path (for external APIs). |
| `docFile` | string | Path to the capability documentation file. |
| `serviceFiles` | string[] or undefined | Paths to key implementation files (for standard capabilities). |
| `infraChanges` | string[] or undefined | Human-readable steps for wiring the capability into the CDK stack (constructs to instantiate, env vars to inject, etc.). Use for capabilities like `data_sync` whose primary surface is CDK + ops scripts rather than `src/modules/`. |
| `scriptsToCopy` | string[] or undefined | Pairs of `*.example` -> destination paths the user must copy and customize. |
| `operationalDocFile` | string or undefined | Path to an operational/runbook doc separate from the capability overview. Prefer one doc per capability; no current capability uses this. |
| `constructFile` | string or undefined | Path to the CDK construct file, for capabilities that ship one. |
| `recommended` | string[] or undefined | Capability IDs that make this one more useful but are not required (unlike `dependencies`). |
| `seams` | string[] or undefined | App-specific extension points (file — what to override), for capabilities with a pluggable default. |
| `securityNotes` | string[] or undefined | Invariants an agent must not break when building on the capability. |

### 3. Create the Module (if applicable)

Create `src/modules/your_capability/` following the existing pattern:

```
src/modules/your_capability/
├── lib/
│   ├── types.ts      # Types exported separately from implementation
│   ├── client.ts     # API client (HTTP calls, auth handling)
│   └── ...           # Other implementation files
└── index.ts          # Barrel exports (public API only)
```

**Rules:**
- `index.ts` is the only public interface — export types and functions from here
- Implementation details stay in `lib/` and are not re-exported
- Config reads from env vars with a `getConfigFromEnv()` function
- All config functions should throw with a clear message if required env vars are missing
- Use `logger` from `@/lib/utils/logger` for logging
- Follow the auth patterns from existing modules (OAuth2 in client_catalog, Basic Auth in upc)

### 4. Create the Schema Fragment (if applicable)

Create `prisma/schema/your_capability.prisma.example`:

```prisma
// =============================================================================
// Your Capability — Prisma Schema Additions
// =============================================================================
//
// Copy these additions into prisma/schema.prisma when enabling this capability.
// Then run: npx prisma migrate dev
//
// 1. Add fields to existing models (shown as comments)
// 2. Add new models (shown as actual model blocks)
//

// --- Add to the Account model ---
//
//   yourField Int? @map("your_field")
//

// --- New model ---

model YourModel {
  id        Int      @id @default(autoincrement())
  name      String
  accountId Int?     @map("account_id")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  account Account? @relation(fields: [accountId], references: [id], onDelete: SetNull)

  @@index([accountId])
  @@map("your_model")
}
```

**Schema conventions:**
- Use `@map("snake_case")` for all column names
- Use `@@map("snake_case")` for table names
- FK audit fields use `onDelete: SetNull`
- FK ownership fields use `onDelete: Cascade`
- Always add relevant indexes
- Show existing model field additions as comments (not as model blocks)
- Show new models as actual Prisma model blocks
- Include the relation back-reference comment for existing models (e.g., "Add `yourModels YourModel[]` to Account")

### 5. Add Environment Variable Stubs

Add a commented-out section to `.env.example`:

```
# =============================================================================
# Optional: Your Capability Name
# See: docs/template/capabilities/YOUR_CAPABILITY.md
# =============================================================================
#YOUR_CAP_BASE_URL=https://your-service-url
#YOUR_CAP_API_KEY=your-api-key
```

### 6. Update the Setup Script

In `scripts/setup.sh`, add your capability to the interactive selector.

**Add to the capability list** (find the numbered list in the "Capabilities selection" section):

```bash
echo "  5) Your Cap       — One-line description"
```

**Add to the case statement:**

```bash
5) caps+=("your_capability") ;;
```

**Add to the notes case statement:**

```bash
your_capability)
    CAP_NOTES="${CAP_NOTES}\n  Your Capability env vars needed:"
    CAP_NOTES="${CAP_NOTES}\n    YOUR_CAP_BASE_URL, YOUR_CAP_API_KEY"
    CAP_NOTES="${CAP_NOTES}\n    Schema: prisma/schema/your_capability.prisma.example"
    ;;
```

**If your capability has dependencies**, add auto-enable logic (see how `upc` auto-enables `client_catalog`).

### 7. Update AGENTS.md

Add your capability to the table in the "Capabilities System" section:

```markdown
| `your_capability` | Your Capability | Optional — one-line description |
```

### 8. Update docs/template/capabilities/README.md

Add your capability to the "Available Capabilities" table:

```markdown
| `your_capability` | Your Capability | Optional | One-line description |
```

### 9. Add npm Dependencies (if needed)

If your module requires npm packages not already in the template, add them to `package.json` and note them in:
- The capability doc (in a "npm Dependencies" section)
- The setup script notes (so users know to install them)

## UI Considerations

If your capability includes UI components, they must follow the design system in `docs/template/DESIGN-SYSTEM.md`:

- Glass morphism: `rgba(255,255,255,0.6)`, `backdrop-blur`, `border-radius: 16px`
- Brand purple `#8D77F7` for focus/active states
- Text `#1a1a1a`, never pure black
- Generous spacing: cards `p-8` minimum
- Desktop-only: minimum 1280px, no mobile breakpoints
- Hover transitions 300ms

## Checklist

Before considering a capability complete, verify:

- [ ] Documentation file exists in `docs/template/capabilities/`
- [ ] Entry added to `_registry.json` with all fields
- [ ] Module created in `src/modules/` with barrel exports (if applicable)
- [ ] Schema fragment in `prisma/schema/` (if applicable)
- [ ] Env var stubs in `.env.example`
- [ ] Added to `scripts/setup.sh` capability selector
- [ ] Added to `AGENTS.md` capabilities table
- [ ] Added to `docs/template/capabilities/README.md` table
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] Dependencies added to `package.json` (if applicable)
