---
created: 2026-10-20T10:39:11.237Z
title: Course creation requests with Save and Publish buttons
area: general
files:
  - app/controllers/courses_controller.ts
  - app/validators/course.ts
  - inertia/pages/courses/create.tsx
  - app/models/app_setting.ts
---

## Problem

Decision Q4 (threat T-02-53) from Phase 2, deferred by the user on 2026-10-20 ("possible de reporter ces correctifs dans des phases ultérieures").

Today a teacher (non-admin) can create a course and publish it directly, skipping approval. Phase 2 deliberately leaves this unchanged (plan 02-11 only validated the input). The user wants it controlled, not hard-forced to draft.

User's request (French, original): « J'aimerais 2 boutons à la création "sauvegarder" et "publier" avec au minimum ces paramètres avec un réglage plateforme ou un plugin qui autorise ou non "la demande de création de cours", par un rôle supérieur ou des users définis, restreint dans certains cas à des catégories (comme des filières) ».

A screenshot of a Moodle "Demande de création de cours" form was attached as the reference. Its fields: full name, short name, course category (a "Sélectionner votre filière/école" selector with search), rich-text summary.

Requirements to cover:

1. The course create form gets two buttons: "Sauvegarder" (saves as draft) and "Publier" (publishes).
2. A platform setting, or a plugin, allows or forbids "course creation requests".
3. Who may create or request: a higher role, or a defined list of users.
4. In some cases the right is restricted to specific categories (for example filières or schools).
5. A Moodle-style request form with the fields above (full name, short name, category, summary).

## Solution

TBD. Starting points:

- The platform setting could live in `AppSetting` (already holds branding and settings).
- Category restriction can reuse `CourseCategory` and the permission model in `course_permission`.
- Authorization belongs in `CoursePolicy` (`app/policies/course_policy.ts`), not inline in the controller.
- The create form already receives the real category list since plan 02-11.
- The approval workflow that exists today (course approval queue, rejection with a reason) is the likely target for "Publier" when the user is not allowed to publish directly.

Candidate phase: a course-management phase after Phase 3 (Complete Stubbed Features). It needs a discuss-phase first to settle the role and per-user model.
