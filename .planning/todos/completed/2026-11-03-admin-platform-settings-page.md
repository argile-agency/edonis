---
created: 2026-11-03T15:00:00.000Z
title: Admin page for platform settings (Moodle-style site administration)
area: general
files:
  - app/models/app_setting.ts
  - database/seeders/app_setting_seeder.ts
  - config/inertia.ts
  - inertia/pages/home.tsx
  - inertia/components/layout/app-header.tsx
  - start/routes.ts
---

## Problem

Platform administrators have no way to change application settings from the UI. The `app_settings` table
(model `AppSetting`, singleton row with `is_active = true`) holds branding, hero texts and feature toggles, but
there is no controller, route, validator or page that edits it. Changing anything on a deployed instance (for
example the public demo at demo.edonis.org) means editing the database by hand.

User's request (French, original, 2026-11-03): « Je trouverais bien pour les administrateurs des plateformes
Edonis qu'ils aient une page pour l'administration des réglages de tous les settings applicatifs comme c'est le
cas dans Moodle. »

Verified state of the code (2026-11-03):

- Fields on `AppSetting`: `appName`, `appLogoUrl`, `appFaviconUrl`, `primaryColor`, `secondaryColor`,
  `accentColor`, `headerHtml`, `footerHtml`, `welcomeMessage`, `heroTitle`, `heroSubtitle`, `heroImageUrl`,
  `showPublicCourses`, `allowRegistration`, `showStats`, `contactEmail`, `supportUrl`, `socialLinks` (JSON).
- Loaded on every request as the shared Inertia prop `appSettings` (`config/inertia.ts`), no cache.
- Actually rendered today: `appName`, `appLogoUrl`, `primaryColor` (`app-header.tsx`), `heroTitle`,
  `heroSubtitle` (`home.tsx`). Not rendered anywhere in `inertia/`: `welcomeMessage`, `headerHtml`,
  `footerHtml`, `contactEmail`, `supportUrl`, `socialLinks`, `heroImageUrl`, `secondaryColor`, `accentColor`,
  `appFaviconUrl`. `showPublicCourses` / `allowRegistration` / `showStats` are only read as fallback defaults in
  `home.tsx`: confirm whether the server enforces them before exposing them as switches.
- `home.tsx` footer hard-codes `© 2024`.
- The only admin pages today are audit logs and user CRUD. No settings entry in the menus.
- Related pending todo `2026-10-20-course-creation-requests-with-save-and-publish-buttons.md` expects a
  platform setting for "course creation requests": this page should be where it lives later.

## Solution

Scope of the first version: one admin-only page, `/admin/settings`, to edit the `AppSetting` row. Nothing
else (no per-course or per-user settings, no environment variables such as `TERMS_VERSION`).

### Layout (Moodle-like, grouped)

Use the existing `inertia/components/ui/tabs.tsx`. One form per tab, each saved independently:

1. **Appearance**: app name, logo URL, favicon URL, primary / secondary / accent colours (validated hex).
2. **Home page**: hero title, hero subtitle, hero image URL, welcome message, show public courses, show stats.
3. **Access**: allow registration.
4. **Contact and support**: contact email, support URL, social links (facebook, twitter, linkedin, github).
5. **Custom HTML** (header / footer): only if the decision on the HTML fields below is "keep".

### Backend (follow existing conventions)

- `app/controllers/app_settings_controller.ts` with `edit` and `update`; `inertia.render('admin/settings', ...)`.
- `app/validators/app_setting.ts` (VineJS): trimmed strings with max lengths, `#RRGGBB` colours, valid email,
  http(s)-only URLs, `socialLinks` limited to the four known keys.
- Route in `start/routes.ts` next to the admin audit-logs route, behind `middleware.auth()` and
  `middleware.role({ roles: ['admin'] })`. Managers do not get access in v1.
- Authorization checked in the controller as well, not only by route middleware (CLAUDE.md: "check both
  authentication AND authorization").
- Audit: `AuditService.logFromContext(ctx, ...)` on every save, metadata = changed keys with old and new
  values (never log values of HTML fields in full, only that they changed).
- After a save, invalidate whatever cache is added; if no cache is added, say so in the PR. The shared prop
  runs one query per request today: acceptable, but flag it.
- Handle `AppSetting.getActiveSettings()` returning null (fresh database): the page must create the row
  rather than crash.

### Frontend

- `inertia/pages/admin/settings.tsx`, `useForm` from `@inertiajs/react`, shadcn components already in
  `inertia/components/ui/`.
- Flash toast on success (existing flash toaster), inline field errors from the validator.
- All labels in French (UI language of the app); a11y: every input labelled, errors tied via `aria-describedby`,
  tabs keyboard-navigable; must pass the axe-core critical/serious check.
- Entry point: admin item in the user menu (`menu_seeder.ts`, register order as per CLAUDE.md) pointing to
  `/admin/settings`.
- Make the settings that are stored but not rendered either visible or removed (see decisions).

## Decisions needed before implementation

1. **`headerHtml` / `footerHtml`**: raw HTML injected into every page is an XSS vector, even admin-only (CSP
   is on, but `style-src` allows `'unsafe-inline'`). Options: drop the two fields in v1; or keep them with the
   server-side sanitizer decided for Phase 6 page content (reuse it, do not write a second one). Recommended:
   drop in v1, add a typed "announcement banner" text field instead (see 2).
2. **Demo / announcement banner**: the public demo needs a visible "demonstration environment, contact
   contact@edonis.org" notice. Add `announcementText` (plain text, optional) rendered at the top of the layout
   when set? Needs a migration (cross-engine, reversible, `down()`). Recommended: yes.
3. **Logo and favicon**: URL fields only in v1, or upload through `FileStorageService` (Phase 4)? Recommended:
   URLs in v1, upload later.
4. **Unrendered fields** (`welcomeMessage`, `contactEmail`, `supportUrl`, `socialLinks`, `heroImageUrl`,
   `secondaryColor`, `accentColor`, favicon): render each in a concrete place (footer for contact and social,
   `<link rel="icon">` for favicon, hero for the image) or remove from the form. A setting that does nothing
   must not be editable.
5. **Multi-tenancy**: CLAUDE.md requires `tenant_id` on tenant-aware tables. `app_settings` has none today:
   state explicitly that v1 is single-tenant and keep the `is_active` singleton.

## Acceptance criteria

- An admin can open `/admin/settings`, change each exposed setting, save, and see the change on the public
  home page and in the header without a deploy.
- A teacher, manager, student and anonymous visitor cannot read or write it (403 / redirect to login).
- Invalid input (bad colour, bad email, `javascript:` URL, oversized text) is rejected with field-level French
  errors; nothing is persisted.
- Each save writes an audit log entry with the changed keys.
- Works on a fresh database where no `app_settings` row exists yet.
- Works on PostgreSQL, MySQL/MariaDB and SQLite (any new column via the helpers in
  `database/helpers/schema_helpers.ts`, JSON handled with `typeof` guards).
- Functional tests (Japa): 200 for admin, 403 for other roles, validation failures, audit row created,
  singleton row updated not duplicated. Browser a11y test for the page.
- `app_setting_seeder.ts` default values match the new defaults; `© 2024` replaced by the current year.
- `bun run lint && bun run typecheck && bun run build && node ace test` green.

## Out of scope

Environment-variable settings, per-course settings, theme editor with live preview, plugin or extension
settings, SSO configuration, import/export of settings, role-based fine-grained settings permissions.

## Context

Immediate need that triggered this: the public demo shows "Certificats reconnus", a feature that does not
exist, and cannot be reworded without a database edit. Interim values for the demo were handed over
separately as an SQL `UPDATE app_settings ...`.

## Decisions (owner, 2026-11-03)

Promoted to **Phase 5.1: Admin platform settings** (v0.1, before the trash phase 5.2): « Immédiatement, avant 5.1 ».

1. `headerHtml` / `footerHtml`: dropped in v1.
2. `announcementText`: yes, with a migration; it replaces the demo banner hard-coded in `home.tsx` (commit `2fc5399`).
3. Logo and favicon: URL fields in v1, upload later.
4. Unrendered fields: « Brancher ceux qui comptent » — wire contact email, support URL and social links (footer), favicon (`<link rel="icon">`), hero image, `allowRegistration` (register page and route, enforced server-side); remove the rest from the form (secondary and accent colours, `showStats`, `showPublicCourses`, `welcomeMessage` if it duplicates the hero). Verified 2026-11-03: none of `allowRegistration`, `showPublicCourses`, `showStats` is enforced server-side today.
5. Single-instance in v1, stated explicitly.

The `© 2024` footer of `home.tsx` was already fixed in `2fc5399`; the "Certificats" card is hard-coded in `home.tsx` (not a setting) and was replaced in the same commit.
