# Deferred items (Phase 05.3)

Found during 05.3-05 (local browser run, SQLite, Playwright chromium 1248). Out of scope for 05.3-05, not fixed.

## 1. Theme colour contrast (axe `color-contrast`, serious)

Shared theme tokens fail WCAG AA contrast, so any page that renders them fails the page-wide axe cases:
- `bg-primary` / `text-primary-foreground`: login submit button (`.hover:bg-primary/90`), header « Tableau de bord » filled button (`nav[aria-label="Navigation principale"] > a[href="/dashboard"]`), panel copy (`#mobile-menu a[href="/dashboard"]`)
- `text-muted-foreground` on cards/subtitles: register, dashboard, course page (« Par … », course code), hub subtitle
- Tabs triggers (`role="tab"`): /admin/settings, /admin hub, course page tabs
- `bg-green-500` status badges on /courses

Because of this, the four new 05.3-05 axe cases (hub, course page with switch, search open, 375px panel) fail locally. The admin settings case and the existing login, register and courses cases also fail. They need a theme-token fix (app.css), which affects the whole app.

## 2. Other pre-existing axe failures (not header)

- login/register: password visibility toggle `button` without accessible name (`button-name`, critical)
- profile: avatar `input[type=file]` without label (`label`, critical)
- /courses: filter `combobox` triggers without name (`button-name`, critical)
- builder "actions menu open": `aria-hidden-focus` (Radix hides siblings while the modal menu is open)

## 3. Login throttle across browser specs

`loginThrottle` allows 5 POST /login per minute per IP, and the memory limiter store lives in the test process. `user_management.spec.ts` gets 429 after auth.spec and navigation.spec have logged in. Only the header and accessibility groups clear the limiter (`group.each.setup(() => limiter.clear())`). The other browser groups need the same reset.
