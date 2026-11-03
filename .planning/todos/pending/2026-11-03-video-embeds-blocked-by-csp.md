---
created: 2026-11-03T12:00:00.000Z
title: Video embeds (Vimeo, YouTube) do not play on the learn page
area: content
files:
  - inertia/pages/courses/learn.tsx
  - config/shield.ts
---

## Problem

Found during the Phase 5 walkthrough (2026-11-03). On `/courses/:id/learn`, a video content with a Vimeo page URL (`https://vimeo.com/<id>/<hash>`) is blocked by the CSP (`default-src 'self'`, no `media-src`).

Two causes:

1. `learn.tsx` (around line 362) puts any non-YouTube URL into a `<video src>`. A Vimeo page URL is not a media file, so it would not play even without the CSP.
2. `config/shield.ts` sets `frameSrc: ["'none'"]`, so the YouTube `<iframe>` branch is blocked too.

The owner chose on 2026-11-03 to wait for Phase 8 rather than patch it now: « b. on attendra ».

## Solution

Handle it in Phase 8 (URL content, embed preview):

- Convert known providers to their embed players (`youtube-nocookie.com/embed/<id>`, `player.vimeo.com/video/<id>?h=<hash>`).
- Allow only those hosts in `frameSrc`.
- Show a plain link for any other URL.
