# Nexauren Architecture

## Source of truth

Nexauren is organized as **Studios → Experiences**.

- `frontend/data/studios.json` is the authoritative Studio registry.
- `frontend/data/tools.json` is the authoritative Experience registry.
- A registered active Experience must have exactly one Studio and one canonical URL.
- Physical Experience pages must agree with the registry.
- Planned Studios cannot expose active Experiences.

Canonical Experience URLs use `/studios/<studio-slug>/<experience-slug>/`.

## Runtime boundaries

Each Experience has a pathname-scoped client state namespace exposed through `window.NexaurenExperience`:

- `get(name, fallback)`
- `set(name, value)`
- `remove(name)`
- `reset()`
- `back(fallback)`

Experience Reset and Back controls can use `data-experience-reset` and `data-experience-back` without sharing state with another Experience.

## Security boundaries

Authentication uses:

- PBKDF2-SHA-256 with 120,000 iterations and a random salt for new passwords.
- Transparent migration of legacy salted SHA-256 passwords after successful login.
- Constant-time digest comparison.
- Database-backed login throttling by normalized email and client-IP hash.
- Generic password-reset responses to avoid account enumeration.
- HttpOnly, Secure and SameSite=Lax session cookies.
- Explicit credentialed CORS origins.

Administrator endpoints must authorize through `isAdmin()` and administrator self-protection prevents destructive actions against the administrator account.

## UI system

`frontend/css/design-system.css` contains canonical design tokens and reusable primitives. The Worker injects it into HTML responses so new and existing pages receive the same base tokens without duplicating `<link>` tags across every Experience.

## SEO

Sitemap membership is derived from the active registry. `scripts/validate-seo.mjs` fails CI if the checked-in sitemap contains stale URLs or misses canonical active Studio/Experience URLs.

## Quality gates

`npm run check` is the required gate before deployment:

1. `check:studios` — registry and physical page consistency.
2. `check:seo` — sitemap/registry consistency.
3. `check:security` — Worker security invariants.
4. `check:worker` — deterministic Worker build and JavaScript syntax validation.

No feature should be merged into `main` with a failing gate.
