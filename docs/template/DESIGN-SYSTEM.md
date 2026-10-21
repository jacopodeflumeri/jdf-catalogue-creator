# Mapp Labs Design System 2.0

> **Status:** Active / Updated
> **Theme:** Elegant Glass (Refined)
> **Core Concept:** A workspace made of light. Surfaces are translucent, actions feel tactile like crystal, and the interface floats.

---

## 1. Design Philosophy

The application feels like a modern, light-filled workspace viewed through frosted glass panels.

* **Transparency over opacity:** Surfaces are frosted glass layers, never solid opaque blocks.
* **Light, not dark:** Backgrounds are warm and luminous. Text is charcoal (`#333333`), never pure black.
* **Tactile Actions:** Primary actions shouldn't look like flat stickers; they should look like backlit crystal objects (The "Prism" effect).
* **Purposeful Color:** The brand purple (`#8D77F7`) is used for focus, active states, and "inner light" within glass elements.

---

## 2. Color System

### Brand Palette

| Token | Value | Usage |
| --- | --- | --- |
| **Primary** | `#8D77F7` | Core brand color. |
| **Primary Light** | `#9E8BFF` | Top of gradients, highlights. |
| **Secondary** | `#7FF4E0` | Teal accent (rare usage). |
| **Text Main** | `#1a1a1a` | "Soft Charcoal" - Body text, headers. |
| **Text Muted** | `rgba(26, 26, 26, 0.6)` | Subtitles, metadata. |

### Background Gradients

* **App Background:** A soft, warm gradient.
* `linear-gradient(135deg, #F1ECE3 0%, #E6E1FF 100%)`


* **Primary Button Fill (Current):** Semi-transparent high-tech purple (not candy gradient).
* `rgba(141, 119, 247, 0.85)`



---

## 3. Shadows & Depth (The "Glow" System)

We do not use standard black drop shadows for primary elements. We use **Colored Glows** to create a feeling of luminosity.

| Token | Value | Use Case |
| --- | --- | --- |
| **Shadow-Glass** | `0 8px 32px 0 rgba(0, 0, 0, 0.05)` | General glass panels, sidebar, cards. |
| **Shadow-Prism** | `0 4px 20px rgba(141, 119, 247, 0.2)` | **Primary Buttons Only**. Tight, close lift. |
| **Shadow-Hover** | `0 6px 24px rgba(141, 119, 247, 0.26)` | Primary Button Hover state. |
| **Inner-Reflection** | `inset 0 1px 0px rgba(255, 255, 255, 0.4)` | Top edge of buttons/cards to mimic a ceiling light. |

---

## 4. Component Library

### A. Buttons (The "Prism" System)

Buttons are the crown jewels of the interface.

#### 1. Primary Button ("The Luminous Prism")

Used for the main action on a page (e.g., "Create Trend Group").

* **Background:** `rgba(141, 119, 247, 0.85)` (semi-transparent, no candy/radial gradient).
* **Backdrop Filter:** `blur(8px)` (`-webkit-backdrop-filter: blur(8px)`).
* **Border:** `1px solid rgba(255, 255, 255, 0.1)`
* **Shadow:** `Shadow-Prism` (tight, close glow).
* **Typography:** White, Weight 600.
* **Hover:** Lift `-1px`, slightly stronger purple fill and tighter glow.

```css
.btn-primary {
  background: rgba(141, 119, 247, 0.85);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 4px 20px rgba(141, 119, 247, 0.2);
  color: white;
  border-radius: 12px;
}

```

#### 2. Secondary Button ("Frosted Glass")

Used for secondary filters and medium-priority controls.

* **Background:** `rgba(255, 255, 255, 0.4)`
* **Backdrop Filter:** `blur(8px)`
* **Border:** `1px solid rgba(255, 255, 255, 0.6)`
* **Text:** Brand Purple (`#8D77F7`) or Charcoal.
* **Hover:** Background becomes `rgba(255, 255, 255, 0.7)`.
* **Note:** In modal footers, **Cancel** actions should use Ghost button styling (below), not Secondary.

#### 3. Tertiary / Ghost Button

Used for low-priority actions and modal cancel actions.

* **Background:** Transparent.
* **Text:** Dark Charcoal (`rgba(26,26,26,0.82)`).
* **Border:** Subtle reflective edge (`1px solid rgba(255,255,255,0.62)`).
* **Hover:** Subtle frosted white wash (`rgba(255,255,255,0.28)`), no heavy fill.

---

### B. Navigation (Sidebar)

#### The Container

* **Surface:** `rgba(255, 255, 255, 0.35)` with `backdrop-filter: blur(20px)`.
* **Border-Right:** `1px solid rgba(255, 255, 255, 0.3)`.

#### Active State ("The Floating Pane")

Instead of a full-width highlight, the active item is a floating glass lozenge.

* **Geometry:** It must have margin. It does *not* touch the edges of the sidebar.
* **Appearance:**
* Background: `rgba(255, 255, 255, 0.5)`
* Border: `1px solid rgba(255, 255, 255, 0.8)`
* Shadow: `0 2px 10px rgba(141, 119, 247, 0.1)`
* Text: Brand Purple (`#8D77F7`), Weight 600.
* Icon: Brand Purple.



#### Inactive State

* **Text:** Charcoal (`#1a1a1a`) at 70% opacity.
* **Hover:** `bg-white/30` (Subtle fade).

---

### App identity

Every app shell must show the app's display name. Use the shared `AppIdentity`
composition in `src/components/shared/layout/AppBranding.tsx`, supplied by the
root server layout; do not read server-only environment variables in client UI.
Keep the Mapp logo and environment indicator in the sidebar, with the app name
below. A configured app logo accompanies the name. Collapsed navigation uses the
app logo or initials with an accessible name and full-name tooltip. On mobile,
the name stays visible in the header when the navigation drawer is closed.
Use the existing text, spacing, glass, and Button styles.

See [App branding](APP-BRANDING.md) for configuration and existing-app adoption.

---

### C. Cards & Containers

Standard "Cards" (like the Overview or Trend Groups container) should feel like polished sheets of glass.

* **Background:** `rgba(255, 255, 255, 0.6)`
* **Border Radius:** `16px` (Soft, friendly corners).
* **Border:** `1px solid rgba(255, 255, 255, 0.4)` (The glass edge).
* **Shadow:** `0 4px 24px -1px rgba(0, 0, 0, 0.05)` (Soft, diffuse lift).
* **Backdrop Blur:** `blur(12px)`.

---

### D. Empty States ("The Creative Void")

When data is missing, the UI should not look broken. It should look inviting.

1. **Container:** Use a standard **Card**.
2. **Illustration:** Must be centered. Use a soft, abstract shape or line-art illustration (opacity 50-80%).
3. **Typography:**
* Headline: "Start your [Object] List" (Charcoal, Bold).
* Subtext: "You haven't created any [Objects] yet." (Muted).


4. **Action:** Place a **Primary Button** directly below the text in the center.

**Say which kind of empty it is.** A blank panel is the trap — only one of
these is actually "you have nothing":

1. **Not set up** — the data source isn't connected or the account isn't
   provisioned. Explain what's missing and who can fix it (often "contact your
   Mapp representative"); never render the ordinary page around nothing.
2. **Quiet window** — there is data, just nothing *new* in the period shown.
   Fall back to the most recent items, retitle the section ("Your latest …")
   and say plainly that nothing is new; drop "New" badges on the fallback.
3. **Genuinely empty** — nothing exists yet. Only this one gets the
   illustration + CTA above (`src/components/ui/EmptyState.tsx`).

---

### E. Inputs & Form Elements

* **Background:** `rgba(255, 255, 255, 0.5)`
* **Border:** `1px solid rgba(255,255,255,0.6)`
* **Focus State:**
* Border changes to Brand Purple (`#8D77F7`).
* Add a glow ring: `box-shadow: 0 0 0 3px rgba(141, 119, 247, 0.2)`.
* **Modal Input Variant ("Etched"):**
* Background: `rgba(255,255,255,0.84)` for stronger contrast against frosted modal panes.
* Border: `1px solid rgba(255,255,255,0.9)`.
* Add subtle etched depth: `inset 0 1px 0 rgba(255,255,255,0.9), 0 0 0 1px rgba(26,26,26,0.03)`.
* **Typeahead / Autocomplete Dropdowns:**
* Use for all entity selection fields (categories, features, brands, etc.) instead of plain `<select>`.
* Text input with type-to-filter dropdown list, outside-click-to-close, keyboard navigation (ArrowUp/Down, Enter, Escape).
* Input: `border border-white/65 rounded-md text-sm`, focus: `focus:ring-2 focus:ring-primary-500 focus:border-primary-500`.
* Label: `text-xs text-[#1a1a1a]/65 mb-1 block`.
* Placeholder convention: `"Type to filter ..."` (e.g. "Type to filter categories...").
* Dropdown: `max-h-60 overflow-auto rounded-md border border-white/70 bg-white/75 shadow-lg`.
* Dropdown items: `px-3 py-2 text-[#1a1a1a] hover:bg-blue-50`, highlighted: `bg-blue-100 font-medium`.
* No-matches message: `text-[#1a1a1a]/55`.
* Inside modals or `overflow:auto` containers: use `createPortal(dropdown, document.body)` with `position: fixed` and `zIndex: 9999` to escape clipping from CSS `contain` and `overflow-hidden`.
* The template ships no typeahead component. The simplest compliant build is a `FormInput` wired to a native `<datalist>`; build a custom dropdown (with the portal rule above) only when you need richer rows.



---

## 5. Implementation Checklist

When implementing these designs in code, verify the following:

* [ ] **No Pure Black:** Are you using `#000000`? Stop. Use `#1a1a1a` or `rgba(0,0,0,0.8)`.
* [ ] **No Hard Shadows:** Are shadows black? Change them to colored or extremely low opacity neutral (`0.05`).
* [ ] **Glass Edge:** Do all glass panels have a `1px` semi-transparent white border? This is crucial for the "Glass" look.
* [ ] **Motion:** Do hover states transition over `300ms`?
* [ ] **Active Floating:** Does the sidebar active state float inside the container (margins on all sides), or is it touching the edges? It should float.

---

## 6. Component Addendum (Underspecified Components)

This addendum documents the component families extrapolated during the full UI refactor.

### A. Modals & Dialogs

* **Surface:** `glass-modal` (`rgba(255,255,255,0.5)` + `blur(28px)` + white edge border).
* **Header/Footer Dividers:** `border-white/65` only (no dark divider lines).
* **Primary CTA:** Prism button style (semi-transparent purple + tight glow).
* **Cancel CTA Hierarchy:** Use Ghost button treatment (transparent + subtle reflective border + charcoal text).
* **Inputs in Modal:** Use etched variant for clarity (`rgba(255,255,255,0.84)` background + crisp border).
* **Overlay:** Neutral veil `rgba(26,26,26,0.16)` with soft blur.

### B. Tables & Data Grids

* **Container:** `ds-table-shell` (glass card + white edge).
* **Header Row:** `ds-table-head` with subtle frosted fill.
* **Rows:** `ds-table-row` with soft white hover (`~300ms`).
* **Empty State:** Centered icon disc + headline + muted helper text + primary CTA.

### C. Tabs & Segmented Controls

* **Container:** Frosted rail (`bg-white/26`, white edge border, rounded 16px).
* **Inactive Tabs:** Frosted pills with charcoal-muted text.
* **Active Tab:** Luminous state (prism for segmented; floating white pane for underline variant).

### D. Badges, Chips, Pills

* **Shape:** Rounded-full with white edge border and backdrop blur.
* **Fill:** Semantic tinted backgrounds at low saturation (10-22% alpha).
* **Typography:** Muted charcoal for neutral; richer semantic tone for status chips.

### E. Notices, Alerts, Toasts

* **Container:** Glass base + semantic tint overlay.
* **Saturation Rule:** Keep semantic backgrounds restrained (do not use fully saturated fills).
* **Icons:** Semantic icon color should match tone family.
* **Toast Motion:** Slide/fade in/out with `300ms` transitions.

### F. Tooltips

* **Default Theme:** Frosted light tooltip (`bg-white/88`, white edge border, subtle shadow).
* **Alternates:** Dark/semantic solid fills allowed for high contrast.
* **Arrow:** Rotated square tip matching tooltip surface.

### G. Pagination, Filters, Search Bars

* **Controls:** Frosted glass controls by default (`frost-button`).
* **Active Page:** Prism button treatment.
* **Text Hierarchy:** Charcoal main + muted charcoal metadata.

### H. Toggles, Checkboxes, Radio-Style Controls

* **Focus Ring:** Purple glow ring (`rgba(141,119,247,0.2)`).
* **Selected State:** Luminous primary or semantic fill with white knob/surface.
* **Unselected State:** Frosted neutral rail with white edge.

### I. Upload Zones & File Rows

* **Dropzone Base:** Glass panel with white edge and subtle blur.
* **Drag Active:** Stronger white fill and elevated edge contrast.
* **Error State:** Semantic red tint overlay with same glass structure.
* **Progress Bars:** Soft neutral track + semantic foreground.

### J. Charts

* **Palette:** Use DS-aligned colors from config (`primary`, `primaryLight`, `secondary`, muted semantic accents).
* **Tooltip:** Frosted white card with blur and white edge border.
* **Axis/Grid:** Muted charcoal labels, very light white grid lines.

### K. Environment/Impersonation Banners

* **Style:** Inline glass badges, no aggressive ribbons.
* **Tone:** Semantic tint with restrained saturation.
* **Placement:** Top-right floating label with white edge border.

### L. Loading & Skeletons

* **Skeleton:** Neutral white shimmer (`ds-skeleton`), never dark gray blocks.
* **Spinner:** White ring + semantic top border accent.
* **A route skeleton (`loading.tsx`) matches the page it stands in for:** the
  same page container classes (max width, padding, vertical rhythm), a header
  block the height of the real `PageHeader`, and placeholders shaped like the
  first content (card rows, grid tiles). Wrap it in `aria-busy="true"`. When
  the page's container changes, change the skeleton with it — a mismatched
  skeleton is a layout shift (and moves the footer) when the page arrives.
  Example: `src/app/account/loading.tsx` ↔ `CompanyCustomerHome.tsx`.
* **Slow server sections stream behind their own `<Suspense>`** with a
  skeleton of the section's shape, so the page header and controls paint at
  once and only the slow part waits. Share the skeleton with `loading.tsx` when
  it's the same shape. Choose the boundary's `key` deliberately: key it on the
  URL params that drive the section (e.g. `key={searchParamsString}`) when
  showing stale results during a filter change would mislead; leave it unkeyed
  when keeping the current view until the new one is ready reads better.
* **Never a full-screen spinner while the client session loads.** Layouts
  render from the server session and never gate `{children}` on
  `useSession()` (SSR status is always `"loading"`) — see the comments in
  `AdminLayoutClient.tsx` / `CustomerLayoutClient.tsx`.
* **Layouts render the top nav with `NavigationComponent`**, not
  `NavigationWrapper`: the wrapper renders nothing until mounted, so the bar
  pops in after hydration and shifts the page (see `src/modules/navigation/index.ts`).

---

## 7. Current Class Reference (Code-Backed)

These are the current production-facing utility classes in `src/app/globals.css` and should be treated as implementation truth unless intentionally revised.

### A. `.prism-button`

* **Base:** `background: rgba(141, 119, 247, 0.85)`, `backdrop-filter: blur(8px)`, `border: 1px solid rgba(255,255,255,0.1)`, `box-shadow: 0 4px 20px rgba(141,119,247,0.2)`.
* **Hover:** slight lift (`translateY(-1px)`), stronger fill (`0.9` opacity), tighter glow (`0 6px 24px rgba(141,119,247,0.26)`).
* **Active:** reduced lift + reduced shadow (`0 3px 14px rgba(141,119,247,0.2)`).
* **Disabled:** lower fill/saturation and reduced glow.

### B. `.glass-modal`

* **Surface:** `rgba(255,255,255,0.5)`.
* **Border:** `1px solid rgba(255,255,255,0.72)`.
* **Depth:** `inset 0 1px 0 rgba(255,255,255,0.6), 0 10px 24px rgba(93,74,174,0.14)`.
* **Blur:** defined as `blur(28px) saturate(170%)`.
* **Overlay pairing:** `rgba(26,26,26,0.16)` + soft backdrop blur.

### C. Modal Input Etched Variant

Scoped under `.glass-modal` for `input/select/textarea` and `.ds-input`:

* **Background:** `rgba(255,255,255,0.84)`.
* **Border:** `1px solid rgba(255,255,255,0.9)`.
* **Etch depth:** `inset 0 1px 0 rgba(255,255,255,0.9), 0 0 0 1px rgba(26,26,26,0.03)`.

### D. `.ghost-button`

* **Role:** modal cancel and low-emphasis actions.
* **Base:** transparent background, charcoal text, subtle reflective white border.
* **Hover:** frosted white wash (`rgba(255,255,255,0.28)`) without becoming a solid block.

---

## 8. Entry Animation System

Pages reveal with a staggered fade-in cascade so content doesn't pop in all at
once. Defined in `src/app/globals.css`; no JavaScript.

| Class | Effect |
|-------|--------|
| `.animate-fade-in` | `fadeInUp 0.5s ease-out both` (fade + 12px rise) |
| `.stagger-1` … `.stagger-6` | `animation-delay` from `0.05s` to `0.3s` (50 ms steps) |

Apply `.animate-fade-in` to each independent block and assign stagger classes
top-to-bottom, in reading order:

```html
<div class="animate-fade-in stagger-1">  <!-- header / hero -->
<div class="animate-fade-in stagger-2">  <!-- first card -->
<div class="animate-fade-in stagger-3">  <!-- second card -->
```

* One stagger class per visual block — don't animate every cell; items rendered
  by `.map()` share their wrapper's delay.
* Keep it tight (stagger-1 to stagger-5 is typical); beyond stagger-6 feels
  sluggish.

---

## 9. Page Headers

Use `src/components/ui/PageHeader.tsx` for every page title — don't hand-roll
`<h1>` styles.

| `size` | Title | Description | Use for |
| --- | --- | --- | --- |
| `default` | `text-4xl font-bold` | `text-lg`, muted | Admin pages |
| `compact` | `text-3xl font-extrabold` | `text-sm`, muted | Customer pages (`/account/*`) |

Customer pages sit under the app's nav and lead into denser content, so they use
the compact scale; the matching skeleton header is `h-9` + `h-5`. Don't repeat
the app name as an eyebrow on each page — the nav already carries it.

---

## 10. Bookmarkable URLs

Every view a user might want to come back to is its URL, so any page can be
bookmarked, shared or reloaded and return exactly as it was.

* **Paths name resources; the query narrows a collection.** `/account/orders`
  is the collection, `/account/orders/<id>` one item; filters, search, sort,
  page and view mode (`?q=`, `?page=`, `?view=table`) go in the query.
* **Ids in URLs survive re-ingest.** Use a natural/external key (e.g. the
  source system's id) rather than an internal row id that changes when data is
  pruned and reloaded.
* **One routes module builds and parses the URLs** for a feature. Nothing else
  hand-writes them, so a scheme change is one file.
* **Unknown or foreign filter values match nothing** — they never widen the
  result (and an id outside the user's entitlement is treated as unknown, or
  404s).
* **Decode catch-all segments.** Next passes `[...slug]` segments still
  percent-encoded (single `[id]` segments are decoded); decode them in the
  parser so ids containing `/` or spaces round-trip.
* **Back links use a sanitised `from` param.** A list links to an item with
  `?from=<list path + query>`, and the item page turns it into its back link.
  `from` is user-controlled: honour only same-origin paths into the expected
  area, rebuild the href from the parsed URL (never echo it), and fall back to
  the default list otherwise.
* **Signing in returns to the bookmark.** The sign-in pages honour NextAuth's
  `callbackUrl` within the chosen login's area (`src/modules/auth/lib/callback-url.ts`).
* **Transient UI state stays out of the URL** — an open panel, a collapsed
  group, a selected gallery image.

---

## 11. Component Inventory (`src/components/ui`)

Every shared UI primitive the template ships, one line each. **Reach for these
before writing new markup** — they already carry the glass tokens above. Paths
are relative to `src/components/ui/`.

### Actions

| Component | What it is for / when to use it |
|---|---|
| `Button` | Every clickable action. `variant`: `primary` (prism — one main action per view), `secondary` (frost), `ghost` / `outline` (cancel and low-emphasis), `danger` (destructive), `icon` (round prism icon button), `simple` / `colorful` / `circle` (light glass chips); `override*` / `menu*` are for nav menus. `size` `xxs`–`lg`; `loading` shows a spinner. |
| `ButtonToggleGroup` | Segmented control of touching buttons (`buttons`, `value`, `onChange`, `size` `xs`–`lg`). Use for view-mode switches (list/grid) and small mutually exclusive filters; for content panels use `Tabs`. |
| `Toggle` | Switch (`variant="toggle"`, default) or styled checkbox (`variant="checkbox"`) for an instant on/off setting outside a form, with optional `label`/`description`/`error`. `colorVariant` `primary` / `warning` / `yellow`. |

### Layout & content

| Component | What it is for / when to use it |
|---|---|
| `Card` | The standard glass container (`glass-card`). Optional `title` / `description` / `headerActions` header and `footer`; `noPadding` / `noPaddingContent` for edge-to-edge content, `hoverable` for clickable cards, `noBg` to drop the glass surface. |
| `PageHeader` | The title block of every page — never hand-roll an `<h1>`. `size="default"` for admin pages, `size="compact"` for customer pages (see §9); `actions` renders buttons on the right. |
| `Tabs` | Tabbed content panels managed client-side (`tabs: { id, label, icon?, content }[]`, `defaultTab`). `variant="underline"` (default) or `"button"`. For a view-mode switch without separate panels, use `ButtonToggleGroup`. |
| `Table` | Data table in a `ds-table-shell`: typed `columns` (`render`, `sortable`, `align`, `width`), client-side sorting, `loading`, `onRowClick`, built-in `pagination`, and an `emptyState`. Use it for any tabular list before building a custom grid. |
| `Pagination` | Page controls + "Showing x–y of z" text for lists that are not inside `Table` (`page`, `limit`, `total`, `onPageChange`). `variant` `default` / `white` / `primary` / `transparent` to match the surface it sits on. |
| `Chart` | ECharts wrapper (`echarts-for-react`) for `bar`, `line` (multi-`series`) and `pie`, coloured from `config.ui.chartColours` / `config.ui.theme`. Use it rather than adding another chart library. |
| `Icon` | The single icon set (`type`, `size` `xs`–`3xl`). Add new glyphs here instead of importing an icon package; the `IconType` union lists what exists. |

### Feedback & status

| Component | What it is for / when to use it |
|---|---|
| `Badge` | Small rounded-full status chip / label (`variant` `primary`, `secondary`, `gray`, `success`, `warning`, `danger`, `blue`, `purple`, `outline`, …; `size` `xxs`–`lg`). |
| `NoticeBox` | Inline notice inside page content (`variant` `info` / `success` / `warning` / `error` / `primary` / `neutral`, optional `title` and icon). Use for persistent, contextual messages; use a toast for transient ones. |
| `EmptyState` | The "genuinely empty" state: icon disc + title + description + optional `action` (see §4.D for when a section is *not* genuinely empty). |
| `Error` | Error block with icon, `title`, `message` and an optional retry button (`onClick`). Use when a section failed to load. |
| `Loading` | Spinner with optional `text` (`size` `xs`–`lg`, `variant` colours the accent), or a shimmer placeholder with `skeleton="text" \| "card" \| "row"`. Use the skeleton form for in-page loading (see §6.L). |
| `Toast` | The toast stack — already mounted once in the root layout. Don't render it yourself; raise toasts with `useToast().addToast({ type, message })` from `@/components/providers/ToastProvider`. |
| `Tooltip` | Hover hint around any element (`content`, `position` incl. the corner variants, `color` `light` / `dark` / semantic, `allowWrap` for long text). |

### Forms (`form/`)

| Component | What it is for / when to use it |
|---|---|
| `form/FormInput` | Labelled text input with `error` / `helpText`, optional leading `icon` and `showClear` button; `inline="sm" \| "lg"` for compact inline rows. |
| `form/FormSelect` | Labelled native `<select>` for full form rows; `options` accepts flat options or `{ label, options }` groups, plus `placeholder`. |
| `form/FormTextarea` | Labelled multi-line input with `error` / `helpText`. |
| `form/FormCheckbox` | Labelled checkbox for a form field that is submitted with the form, with `error` / `helpText`. For an instant on/off setting, use `Toggle`. |
| `SearchInput` | A search box in its own glass card (`FormInput` with search icon + clear), for the search bar above a list. Inside a filter dropdown, use `filter/FilterSearch`. |

### Filters (`filter/`)

| Component | What it is for / when to use it |
|---|---|
| `filter/FilterDropdown` | Frosted dropdown trigger + panel for one filter dimension (`label`, `icon`, `activeFilters` shown on the trigger). Put `FilterOption`s or `FilterSearch` inside it. |
| `filter/FilterOption` | One selectable option row inside a `FilterDropdown` (`label`, `count`, `isActive`). |
| `filter/FilterSearch` | Compact search field for the top of a `FilterDropdown` panel, to narrow long option lists. |
| `filter/FilterClearButton` | Icon button that resets all filters in a filter bar. |

### Modals (`modal/`)

| Component | What it is for / when to use it |
|---|---|
| `modal/Modal` | The `glass-modal` dialog: `isOpen` / `onClose`, `title`, `size` `sm`–`xxl` / `full`, optional `footer`, `loading`, `noScroll`. Base for every custom dialog. |
| `modal/ConfirmDialog` | Ready-made "are you sure?" dialog (`title`, `message`, `confirmText`, `variant` `danger` / `warning` / `info`, `isLoading`). Use it for every destructive or irreversible action instead of a custom modal. |
| `modal/LoadingModal` | Blocking overlay with spinner, `title` and `description` while a long operation runs and the user must wait. Prefer in-page `Loading` when the user can keep working. |
| `modal/Alert` | Semantic message strip with icon, for messages *inside* a modal or form (`variant` `primary` / `secondary` / `success` / `warning` / `danger` / `outline`). On a page, use `NoticeBox`. |
