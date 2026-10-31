---
phase: 05-builder-ui
plan: 05
subsystem: builder-ui
tags: [react, radix, a11y, builder]
requires: [05-02]
provides: [InlineTitle, DetailsPanel, ItemActionsMenu]
affects: [05-06, 05-08]
tech-stack:
  added: []
  patterns: [controlled presentational components, entity-derived ids, onCloseAutoFocus focus targets]
key-files:
  created:
    - inertia/components/builder/inline-title.tsx
    - inertia/components/builder/details-panel.tsx
    - inertia/components/builder/item-actions-menu.tsx
  modified: []
decisions:
  - "DetailsPanel date fields commit on blur only (not on every change), to avoid sending partial years typed segment by segment"
  - "DetailsPanel sends both dates together in one patch, so a date held back by the order check goes out once fixed"
  - "ItemActionsMenu falls back to its own trigger for focus when onCloseFocusTarget returns null"
metrics:
  duration: ~20min
  completed: 2026-10-31
---

# Phase 5 Plan 05: Builder item components Summary

Three controlled, accessible per-item components for the builder: an inline title editor, a details panel (description, published, availability dates with an order check), and an actions menu (Monter / Descendre / "Déplacer vers…" dialog / Supprimer with an AlertDialog). None of them fetch data or use dnd-kit.

## Tasks

| Task | Name | Commit |
| ---- | ---- | ------ |
| 1 | InlineTitle and DetailsPanel | bcd8587 |
| 2 | ItemActionsMenu | 8554682 |

## Contract notes for 05-06

The prop names match the `<contract>` exactly. Behaviour details the page must know:

- **InlineTitle**: on blur, the value is compared with `title` (not with the draft). A kept conflict draft that differs from the saved title is therefore submitted again on blur. After Enter or Escape, blur is ignored until the teacher types again, so the page can keep `editing` true after a conflict and the next blur still works.
- **DetailsPanel**: `kind` is accepted but not used, since all fields are the same for sections and contents. Dates send `{ availableFrom, availableUntil }` together, both as `yyyy-MM-dd | null`. Description sends `null` when the trimmed text is empty. The id of the `errorMessage` element is `${idBase}-panel-error`, and the id of the date-order error is `${idBase}-dates-error`.
- **ItemActionsMenu**: the trigger has `id={`${idBase}-actions`}` and size `icon-sm` (32 px). If `onCloseFocusTarget` returns null, focus goes back to the trigger when it is still connected. If the page removes the row as soon as `onDelete` runs, the AlertDialog unmounts together with the row. Radix still calls `onCloseAutoFocus` on unmount, but 05-06 should check in the browser that focus lands on the neighbour. An empty `moveTargets` list shows "Aucune destination disponible.".

## Deviations from Plan

- **[Rule 2 - a11y] Focus fallback to the trigger.** Without `onCloseFocusTarget`, closing a dialog opened from the menu would put focus on `<body>`, because the menu item that had focus is gone. File: item-actions-menu.tsx. Commit: 8554682.
- **Dates save on blur only.** The contract says "change or blur". Saving on every change would send intermediate years (e.g. 0002-…) while the teacher types.
- **Base fast-forward.** The worktree started at d8bb4fb. It was fast-forwarded (`git merge --ff-only`) to the wave base ae66b1f rather than reset, because the target was a descendant and the tree was clean.

## Verification

- eslint (jsx-a11y) on the three files: OK. Full `bun run lint` exits 0.
- `tsc -p inertia/tsconfig.json` shows 0 errors under `inertia/components/builder/`. The project has 182 unrelated errors elsewhere, which were already there.
- `dangerouslySetInnerHTML` appears 0 times under `inertia/components/builder/` (T-05-19).
- There is no `modal={false}`. The non-empty "Supprimer" item uses `aria-disabled` together with `aria-describedby` and is not Radix-disabled.
- There is no behaviour test here. Browser coverage is planned for 05-06 and axe coverage for 05-08.

## Self-Check: PASSED

- All three files exist. Commits bcd8587 and 8554682 are on the branch.
