# Phase 5: Builder UI - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-28
**Phase:** 05-builder-ui
**Areas discussed:** Déplacer : entre sections et imbrication, Édition en ligne et suppression, Clavier, tactile et accessibilité

Area offered but not selected: Sauvegarde automatique et indicateur (left to Claude's discretion in CONTEXT.md).

Code scout findings shown to the user before the discussion: the pencil and trash buttons of the builder have no handlers; the reorder endpoints only renumber within a module and cannot move content between sections; modules are nested via `parentId`; `deleteModule` has no emptiness check; `@dnd-kit` is not installed.

---

## Todo cross-reference

| Option | Description | Selected |
|--------|-------------|----------|
| Non, il reste à part (Recommandé) | Concerns the course creation page and a platform setting, not the content builder | ✓ |
| Oui, l'intégrer à la phase 5 | Adds a platform setting with roles and categories | |

**User's choice:** Non, il reste à part

---

## Déplacer : entre sections et imbrication

### Dragging a section

| Option | Description | Selected |
|--------|-------------|----------|
| Réordonner entre sections de même niveau seulement (Recommandé) | Strict reading of BUILD-03, no cycle risk | |
| Aussi changer de parent en la déposant dans une autre section | New endpoint, cycle protection, recomputed levels | ✓ |
| Je laisse le planificateur décider | Simplest solution satisfying BUILD-01..03 | |

**User's choice:** Aussi changer de parent en la déposant dans une autre section

### Maximum depth

| Option | Description | Selected |
|--------|-------------|----------|
| Limiter à 3 niveaux (Recommandé) | Readable; the endpoint refuses deeper drops | ✓ |
| Aucune limite | Faithful to the model, risk of very deep trees | |
| Je laisse le planificateur décider | A reasonable documented limit | |

**User's choice:** Limiter à 3 niveaux

### Where a content can be dropped

| Option | Description | Selected |
|--------|-------------|----------|
| Toute section, vide ou repliée ; elle s'ouvre au survol (Recommandé) | Drop on a collapsed header (expands after a delay) or in an empty section | ✓ |
| Seulement les sections déjà dépliées | Simpler, but empty sections have no clear drop zone | |

**User's choice:** Toute section, vide ou repliée ; elle s'ouvre au survol

---

## Édition en ligne et suppression

### Deleting a non-empty section

| Option | Description | Selected |
|--------|-------------|----------|
| Refuser : seule une section vide se supprime (Recommandé) | BUILD-06; button disabled; server refuses | |
| Autoriser avec une confirmation qui compte ce qui sera perdu | Goes beyond BUILD-06; loss without undo | ✓ (initially) |
| Je laisse le planificateur décider | BUILD-06 to the letter | |

**User's choice:** Autoriser avec une confirmation qui compte ce qui sera perdu
**Notes:** « Mais ce n'est pas tout de suite perdu. Ça demande une confirmation à la suppression, mais c'est dans une corbeille qui est accessible depuis le cours et l'édition du cours. Donc c'est un soft delete, on va dire, dans un premier temps. Après 30 jours, la corbeille est vidée dans un premier temps, sauf si au niveau de l'administration de la plateforme, du LMS, le réglage est configuré différemment. »

### How to place the trash (follow-up)

| Option | Description | Selected |
|--------|-------------|----------|
| Phase dédiée juste après ; en phase 5, section vide seulement (Recommandé) | Phase 5 deletes empty sections only; the trash arrives in its own phase and then allows non-empty sections | ✓ |
| Inclure la corbeille dans la phase 5 | Soft delete, trash page, restore, 30-day purge, admin setting; about twice as big | |
| Suppression définitive avec confirmation maintenant, corbeille plus tard | Irreversible loss until the trash exists | |

**User's choice:** Phase dédiée juste après ; en phase 5, section vide seulement

### Inline editing

| Option | Description | Selected |
|--------|-------------|----------|
| Titre directement ; le reste dans un panneau déroulant (Recommandé) | Title in place; description, published, dates in an expandable panel | ✓ |
| Titre en ligne, le reste dans une fenêtre comme aujourd'hui | Simplest | |
| Tout en ligne, y compris description et dates | Denser list, more keyboard errors | |

**User's choice:** Titre directement ; le reste dans un panneau déroulant

---

## Clavier, tactile et accessibilité

### Alternatives to dragging

| Option | Description | Selected |
|--------|-------------|----------|
| Clavier du glisser + menu « Déplacer vers… » (Recommandé) | dnd-kit keyboard sensor with French announcements, plus a move menu (WCAG 2.5.7) | ✓ |
| Seulement le capteur clavier du glisser | 2.5.7 not covered | |
| Seulement des boutons Monter / Descendre et le menu Déplacer vers… | No keyboard drag | |

**User's choice:** Clavier du glisser + menu « Déplacer vers… »

### Touch

| Option | Description | Selected |
|--------|-------------|----------|
| Oui, par la poignée ; le menu Déplacer vers… en secours (Recommandé) | Handle-only touch drag, menu as fallback | ✓ |
| Non : sur tactile, seulement le menu Déplacer vers… | No touch drag | |
| Je laisse le planificateur décider | Suitable dnd-kit sensors | |

**User's choice:** Oui, par la poignée ; le menu Déplacer vers… en secours

---

## Presence and conflicts (raised by the user at the end)

**User's question:** « Est-ce qu'il y a un moyen de faire en sorte, un peu comme dans Figma, quand on travaille sur le même whiteboard en même temps, mais là, dans ce cas-là, quand on travaille en même temps dans le même cours, de voir que l'autre professeur est en train de travailler et où il est en train de travailler, par exemple. C'est le cas dans Microsoft. On voit si quelqu'un est en train d'éditer une cellule dans un tableau. »

| Option | Description | Selected |
|--------|-------------|----------|
| Plus tard ; en phase 5, détecter les conflits d'édition (Recommandé) | Presence noted as deferred; saving an element changed meanwhile shows a message | ✓ |
| Plus tard, sans détection de conflit en phase 5 | Last write wins | |
| Inclure une présence simple dans la phase 5 | Periodic refresh presence indicator; phase grows | |

**User's choice:** Plus tard ; en phase 5, détecter les conflits d'édition

---

## Claude's Discretion

- Autosave and the save indicator (BUILD-10): immediate save per action, accessible indicator, rollback and retry on failure. The user answered "Je suis prêt pour le contexte".

## Deferred Ideas

- Trash / soft delete as a dedicated phase after phase 5 (30-day purge, retention configurable by the platform administrator, restore, reachable from the course and from course editing)
- Real-time presence and, later, co-editing
- Undo/redo and keyboard shortcuts (already BUILD-V2-01 and BUILD-V2-02)
