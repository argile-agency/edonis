---
created: 2026-11-17T13:39:04.000Z
title: Rethink how HTML is authored and styled in course activities
area: content
files:
  - app/helpers/sanitize_html.ts
  - app/controllers/course_contents_controller.ts
  - inertia/pages/courses/learn.tsx
  - inertia/pages/courses/builder.tsx
  - inertia/css/app.css
---

## Problem

A stored XSS was found and fixed on 2026-11-17: `/courses/:id/learn` injected a page content's HTML as-is, and a teacher-authored `<img onerror=…>` ran in the viewer's session. The fix (`9f4e70c`, `b2ae513`) sanitizes page HTML at render with `sanitize-html` in `app/helpers/sanitize_html.ts`.

That fix is a security patch, not a product decision. The owner asked on 2026-11-17 to set aside a proper brainstorming before going further. What is provisional:

- The allow-list of inline styles (colour, alignment, font size and weight, spacing, width, border) was chosen in a hurry so teachers keep basic formatting.
- `class` is stripped entirely, because the app's own utility classes (`fixed inset-0 z-50`) would let a page cover the interface.
- Inline colours ignore the theme: black text set inline becomes unreadable in dark mode, and nothing checks contrast.
- Teachers still type raw HTML in a textarea in the builder.
- Sanitizing happens on render only; stored content is unchanged.

Open questions for the brainstorming:

1. Authoring model for teachers: raw HTML, rich editor, Markdown, or a mix.
2. What the theme owns versus what a teacher may style inline (theme tokens or named classes instead of free colours).
3. How accessibility holds in both light and dark modes (contrast of teacher-chosen colours, axe-core coverage of rendered content).
4. Whether SEO matters at all here: the learn page is behind login, so content HTML is not crawled today.

## Solution

TBD — fold into the Phase 6 (Page Content) discussion, which already plans a Tiptap-class editor with a source mode and an allow-list sanitizer on save and on render (PAGE-06, PAGE-08). Decide the allow-list there and replace the provisional one; add sanitizing on save; consider a short documented set of named classes via `allowedClasses` rather than free `class`.
