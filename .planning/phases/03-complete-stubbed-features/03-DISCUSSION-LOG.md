# Phase 3: Complete Stubbed Features - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-28
**Phase:** 03-complete-stubbed-features
**Areas discussed:** À corriger : définition et périmètre, Lien vers la correction

Areas offered but not selected: E-mail de notification, Contact : stockage et anti-spam (left to Claude's discretion in CONTEXT.md).

---

## À corriger : définition et périmètre

### Counters

| Option | Description | Selected |
|--------|-------------|----------|
| À corriger = soumis ; Corrigé = graded + returned (Recommandé) | Total = every submission handed in, excluding drafts; total = pending + graded | ✓ |
| Total inclut aussi les brouillons | Drafts inflate the total; total ≠ pending + graded | |
| Je laisse le planificateur décider | Simplest definition consistent with the statuses | |

**User's choice:** À corriger = soumis ; Corrigé = graded + returned

### Scope of courses

| Option | Description | Selected |
|--------|-------------|----------|
| Les siens + co-enseignant edit/manage ; admins : tous (Recommandé) | Consistent with AS2, reuses CoursePolicy.viewGradebookAsInstructor | ✓ |
| Seulement les cours qu'il possède ; admins : tous | Strict reading of the roadmap wording; inconsistent with AS2 | |
| Seulement les siens, y compris pour les admins | No global view for admins | |

**User's choice:** Les siens + co-enseignant edit/manage ; admins : tous

### Access to /evaluations

| Option | Description | Selected |
|--------|-------------|----------|
| Enseignants et admins ; étudiant = page 403 (Recommandé) | Students get the 403 page, tested | ✓ |
| Tout utilisateur connecté, liste vide s'il n'enseigne rien | Current behaviour kept | |

**User's choice:** Enseignants et admins ; étudiant = page 403
**Notes:** A follow-up was needed because the manager dashboard links to /evaluations (see "Managers" below).

### Order and pagination

| Option | Description | Selected |
|--------|-------------|----------|
| Plus anciennes d'abord, 20 par page (Recommandé) | First come, first graded | ✓ |
| Plus récentes d'abord, 20 par page | Newest first | |
| Je laisse le planificateur décider | Stable order and pagination | |

**User's choice:** Plus anciennes d'abord, 20 par page
**Notes:** « Idéalement il n'y aura pas qu'un seul ordre, il y aura des filtres pour organiser et filtrer les soumissions à corriger. »

### Filters and sorts (multi-select)

| Option | Description | Selected |
|--------|-------------|----------|
| Filtre par cours | Dropdown of the courses the user may grade | ✓ |
| Filtre par devoir | Assignments, narrowed by the selected course | ✓ |
| Recherche par nom ou e-mail d'étudiant | Free-text search | |
| Tri : date de remise (asc/desc), étudiant, devoir | Column sorting, date ascending by default | ✓ |

**User's choice:** Filtre par cours, filtre par devoir, tri (date de remise, étudiant, devoir)

---

## Lien vers la correction

### Link target

| Option | Description | Selected |
|--------|-------------|----------|
| Carnet de notes du cours ; page de saisie plus tard (Recommandé) | Rows open /grades/courses/:id; grade entry deferred | ✓ |
| Créer une page de correction par soumission maintenant | New capability: grade + feedback page, route, validator, policy, tests | |
| Je laisse le planificateur décider | Smallest solution satisfying EVAL-03 | |

**User's choice:** Carnet de notes du cours ; page de saisie plus tard
**Notes:** Discovery shown to the user: no route exists anywhere to enter a grade; the gradebook is read-only.

### Managers

| Option | Description | Selected |
|--------|-------------|----------|
| Comme un admin : toutes les soumissions de tous les cours (Recommandé) | Matches "Superviser"; no filière scoping exists in permissions | ✓ |
| Comme un enseignant : seulement les cours où il est propriétaire ou co-enseignant | No global view; card label misleading | |
| Retirer la carte des managers, 403 pour eux | Managers lose today's (empty) access | |

**User's choice:** Comme un admin : toutes les soumissions de tous les cours

**REVISED 2026-10-28 (plan-checker raised the privacy impact of letting managers open every gradebook):** the user reversed this choice and chose "Non : retirer l'accès global des managers (comme un enseignant)". Notes: « Un supervisor ou un manager de cours ne voit pas forcément tous les cours. Il ne voit que les cours qu'il manage. À la limite, il faudrait qu'il y ait des permissions pour manager tous les cours d'une catégorie si besoin. Mais autrement, c'est vraiment uniquement les cours concernés. Seuls les admins voient tous les cours de la plateforme. Personne d'autre. » Category-level manager permissions were noted as a deferred idea. CONTEXT.md D-03 and D-04 reflect the revised decision.

---

## Claude's Discretion

- Contact form (CONTACT-01..03): mail mechanism, storage and retention, GDPR handling, anti-spam, rate-limit values. The user answered "Je suis prêt pour le contexte" when offered to explore it.

## Deferred Ideas

- Grade and feedback entry page (new capability, assessment phase)
- Free-text student search on the evaluations list
- Admin inbox for contact messages
