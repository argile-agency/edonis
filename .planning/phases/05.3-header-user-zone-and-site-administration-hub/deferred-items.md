# Deferred items (Phase 05.3)

Found during 05.3-05 (local browser run, SQLite, Playwright chromium 1248). Out of scope for 05.3-05, not fixed then. The correction pass after 05.3-05 (2026-11-12) resolved §1 to §3; §4 is new and stays open.

## 1. Theme colour contrast (axe `color-contrast`, serious) — RESOLVED (b9f5cc2, a234ef3)

Shared theme tokens fail WCAG AA contrast, so any page that renders them fails the page-wide axe cases:
- `bg-primary` / `text-primary-foreground`: login submit button (`.hover:bg-primary/90`), header « Tableau de bord » filled button (`nav[aria-label="Navigation principale"] > a[href="/dashboard"]`), panel copy (`#mobile-menu a[href="/dashboard"]`)
- `text-muted-foreground` on cards/subtitles: register, dashboard, course page (« Par … », course code), hub subtitle
- Tabs triggers (`role="tab"`): /admin/settings, /admin hub, course page tabs
- `bg-green-500` status badges on /courses

Because of this, the four new 05.3-05 axe cases (hub, course page with switch, search open, 375px panel) fail locally. The admin settings case and the existing login, register and courses cases also fail. They need a theme-token fix (app.css), which affects the whole app.

**Resolution.**
- b9f5cc2 changed the tokens:
  - light `--primary` 32% → 28%, `--muted-foreground` 45% → 40%, `--success` 40% → 30%, `--destructive` 55% → 48%
  - dark `--primary-foreground` and `--success-foreground` → dark text
  - sonner richColors light status texts darkened
- The status badges now use the theme `Badge` variants instead of `bg-green-500`/`bg-yellow-500`.
- The tabs needed no component change: they pass with the new muted token.
- a234ef3: part of the reported failures was a measurement artefact. Axe sampled colours while the body `fonts-loaded` fade (0.2s) and the toast enter animations were still running. The browser specs now call axe through `tests/browser/helpers/axe.ts`, which waits for finite animations to end.

## 2. Other pre-existing axe failures (not header) — RESOLVED (84e8a5d)

- login/register: password visibility toggle `button` without accessible name (`button-name`, critical). Fixed with French `aria-label`s that follow the state: « Afficher / Masquer le mot de passe » and « … la confirmation du mot de passe ».
- profile: avatar `input[type=file]` without label (`label`, critical). Fixed with `id="avatar"` and an sr-only `Label`, « Choisir une photo de profil ».
- /courses: filter `combobox` triggers without name (`button-name`, critical). Fixed with `aria-label` « Filtrer par statut » and « Filtrer par catégorie ».
- builder "actions menu open": `aria-hidden-focus` (Radix hides siblings while the modal menu is open). Fixed with `DropdownMenu modal={false}`, plus `onFocusOutside` prevented, because builder refocus after a save otherwise closed the non-modal menu. That closing broke `builder.spec` « deletes go to the trash… ». Escape and clicking outside still close the menu. Per Radix, Tab stays inside the menu; this was not checked here.

## 3. Login throttle across browser specs — RESOLVED (626d008, eb02016)

`loginThrottle` allows 5 POST /login per minute per IP, and the memory limiter store lives in the test process. `user_management.spec.ts` gets 429 after auth.spec and navigation.spec have logged in. Only the header and accessibility groups clear the limiter (`group.each.setup(() => limiter.clear())`). The other browser groups need the same reset.

**Resolution.**
- 626d008: every browser group that logs in now clears the limiter (auth, navigation, user_management, grades, builder, builder_bulk, builder_trash).
- eb02016: `grades.spec.ts` also failed against a seeded DB. It created `student@edonis.test` and `CS101`, which collide with the seed, and its teardown deleted **every** user and course.
  - It now uses `grades-*@edonis.test` users and the course code `GRADES-E2E`.
  - Its teardown deletes only its own rows.
  - Its selectors now match the login form (`input[type=…]`, `**/dashboard`).

## 4. SQLite boolean casting in builder_bulk (open, new, not accessibility)

Two `builder_bulk.spec.ts` cases fail on SQLite only:
- « duplicate places a draft copy… »
- « a rename queued after a bulk publish… »

Both fail with `expected 0 to be false` / `expected 1 to be true`. `CourseContent.isPublished` has no boolean `consume`, so SQLite returns 0/1. `AppSetting` already uses `booleanColumn = { consume: Boolean }`. CI runs these specs on PostgreSQL, which returns real booleans. The fix belongs in the model (cross-engine), not in this accessibility pass.

## 5. Follow-ups found in this pass (open, outside the axe cases)

- **Builder menu focus trade-off.** Preventing `onFocusOutside` keeps the menu open but does not return focus to it. If the builder refocuses a row after a save while the menu is open, keyboard focus sits on the row until Escape. This only happens after a save-triggered refocus, and the keyboard specs pass. The proper fix is to skip the builder's post-save refocus while an actions menu is open.
- **Raw green fills with white text, not covered by axe cases:**
  - `bg-green-600` publish buttons in `courses/show.tsx` and `courses/edit.tsx`: 3.22:1
  - `text-green-600` grade figures on the grades pages: about the same ratio
  - Moving them to the `success` token (5.52:1) fixes both.
- **UI-SPEC drift.** The colour table in `05.3-UI-SPEC.md` still shows the old `--primary` and `--muted-foreground` hex values.
