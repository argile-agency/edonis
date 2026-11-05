import { Head, Link, router, useForm } from '@inertiajs/react'
import { useEffect, useRef, useState, type ComponentProps } from 'react'
import { createPortal } from 'react-dom'
import {
  closestCenter,
  DndContext,
  type Announcements,
  type DragEndEvent,
  type DragMoveEvent,
  type DragOverEvent,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { Eye, FileText, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Textarea } from '~/components/ui/textarea'
import { Card, CardContent } from '~/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { Label } from '~/components/ui/label'
import { Switch } from '~/components/ui/switch'
import AppHeader from '~/components/layout/app-header'
import { BuilderRow, type BuilderRowProps } from '~/components/builder/builder-row'
import type { DetailsValues } from '~/components/builder/details-panel'
import { SaveStatus } from '~/components/builder/save-status'
import { BulkActionBar, elements, SelectionControls } from '~/components/builder/bulk-action-bar'
import { sendJson, useSaveQueue } from '~/lib/builder_save_queue'
import type { SaveError } from '~/lib/save_queue'
import {
  applyBulkMove,
  applyBulkPatch,
  applyContentMove,
  applySectionMove,
  buildRows,
  bulkDeletedIds,
  bulkMoveTargets,
  mergeBulkResult,
  moveTargets,
  pruneSelection,
  quickSelect,
  rowKey,
  selectedItems,
  topLevelItems,
  type BulkResult,
  projectContentDrop,
  projectSectionDrop,
  sectionRowsForDrag,
  siblingPlacement,
  type BuilderContent,
  type BuilderRow as Row,
  type BuilderSection,
  type ContentType,
  type ItemRef,
  type Placement,
} from '~/lib/builder_tree'

type HeaderProps = ComponentProps<typeof AppHeader>

interface Props {
  course: { id: number; title: string; code: string }
  sections: BuilderSection[]
  contents: BuilderContent[]
  auth: { user: HeaderProps['user'] }
  appSettings: HeaderProps['appSettings']
  menus: HeaderProps['menus']
  /** count: trash-list roots of the course; retentionDays: AppSetting.trashRetentionDays. */
  trash: { count: number; retentionDays: number }
}

type ItemPatch = Partial<
  Pick<
    BuilderSection,
    'title' | 'description' | 'isPublished' | 'availableFrom' | 'availableUntil' | 'updatedAt'
  >
>
type Saved = { item: { id: number; updatedAt?: string | null }; batch?: string }
type Snapshot = { sections: BuilderSection[]; contents: BuilderContent[] }
type Projection = (Placement & { depth?: number }) | null

/** Row indentation; also the horizontal drag distance for one section level. */
const INDENT_PX = 24
const ROOT_LABEL = 'Racine du cours'
const DRAG_INSTRUCTIONS =
  "Pour déplacer, appuyez sur Espace, utilisez les flèches haut et bas (gauche et droite pour changer le niveau d'une section), puis Espace pour déposer ou Échap pour annuler."

/** Sections: Up/Down keep the level shift, Left/Right change the level. Contents: vertical only. */
const builderKeyboardCoordinates: KeyboardCoordinateGetter = (event, args) => {
  if (!String(args.active).startsWith('s-')) return sortableKeyboardCoordinates(event, args)
  const { currentCoordinates } = args
  if (event.code === 'ArrowLeft' || event.code === 'ArrowRight') {
    event.preventDefault()
    const shift = event.code === 'ArrowRight' ? INDENT_PX : -INDENT_PX
    return { ...currentCoordinates, x: currentCoordinates.x + shift }
  }
  const next = sortableKeyboardCoordinates(event, args)
  return next && { ...next, x: currentCoordinates.x }
}

const urlOf = (ref: ItemRef) =>
  ref.kind === 'section' ? `/modules/${ref.id}` : `/contents/${ref.id}`
const refOf = (row: Row): ItemRef => ({ kind: row.kind, id: row.id })

/** Snapshot rows with the current `updatedAt` of every item still present. */
function withCurrentTokens<T extends { id: number; updatedAt: string | null }>(
  snapshot: T[],
  current: T[]
): T[] {
  const tokens = new Map(current.map((item) => [item.id, item.updatedAt]))
  return snapshot.map((item) =>
    tokens.has(item.id) ? { ...item, updatedAt: tokens.get(item.id) ?? null } : item
  )
}

export default function CourseBuilder(props: Props) {
  const { course, auth, appSettings, menus } = props
  const { retentionDays } = props.trash
  // Trash-list roots: +roots after a delete, -roots after an undo (D-16), no reload.
  const [trashCount, setTrashCount] = useState(props.trash.count)

  // Local optimistic state. The refs are written only by commitSections / commitContents,
  // synchronously, because the queue starts the next op's run() before React re-renders.
  const [sections, setSections] = useState(props.sections)
  const [contents, setContents] = useState(props.contents)
  const sectionsRef = useRef(props.sections)
  const contentsRef = useRef(props.contents)
  // Row keys ('s-12', 'c-34'), data-based: rows inside collapsed sections can be selected.
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const prune = () =>
    setSelected((prev) => {
      const next = pruneSelection(prev, sectionsRef.current, contentsRef.current)
      return next.size === prev.size ? prev : next
    })
  const commitSections = (next: BuilderSection[]) => {
    sectionsRef.current = next
    setSections(next)
    prune()
  }
  const commitContents = (next: BuilderContent[]) => {
    contentsRef.current = next
    setContents(next)
    prune()
  }

  const [expanded, setExpanded] = useState(() => new Set(props.sections.map((s) => s.id)))
  const knownSectionIdsRef = useRef(new Set(props.sections.map((s) => s.id)))
  const latestPropsRef = useRef<Snapshot>({ sections: props.sections, contents: props.contents })
  const appliedPropsRef = useRef(latestPropsRef.current)

  const [editing, setEditing] = useState<{ key: string; draft?: string; error?: string } | null>(
    null
  )
  const [openPanels, setOpenPanels] = useState<Set<string>>(() => new Set())
  const [panelErrors, setPanelErrors] = useState<Record<string, string>>({})
  const [pendingFocusId, setPendingFocusId] = useState<string | null>(null)
  const pendingFocusRef = useRef<string | null>(null)

  const queue = useSaveQueue()

  // Ops settled so far (saved or failed). Props from a visit that started before an op
  // settled may have been read before that op committed: they are dropped and fetched again.
  const settledRef = useRef(0)
  // Settled count at the start of the visit whose props arrived last (set in its onSuccess,
  // which Inertia runs before React re-renders); null = unknown, props applied as they are.
  const propsStartRef = useRef<number | null>(null)
  const resyncRef = useRef(false)
  /** onSuccess for every visit that returns `sections`/`contents`; call it when the visit starts. */
  const trackVisit = () => {
    const start = settledRef.current
    return () => {
      propsStartRef.current = start
    }
  }
  // Plain partial reload: the `reload()` helper would also dismiss the retry list.
  const resync = () => router.reload({ only: ['sections', 'contents'], onSuccess: trackVisit() })

  // Props re-sync: new server props (creation, "Recharger") are applied once no save is in flight.
  useEffect(() => {
    const latest = latestPropsRef.current
    if (latest.sections !== props.sections || latest.contents !== props.contents) {
      latestPropsRef.current = { sections: props.sections, contents: props.contents }
    }
    if (queue.pending > 0) return
    let stale = resyncRef.current
    resyncRef.current = false
    if (latestPropsRef.current !== appliedPropsRef.current) {
      const next = latestPropsRef.current
      appliedPropsRef.current = next
      const start = propsStartRef.current
      propsStartRef.current = null
      if (start !== null && start !== settledRef.current) {
        stale = true
      } else {
        commitSections(next.sections)
        commitContents(next.contents)
        const fresh = next.sections.filter((s) => !knownSectionIdsRef.current.has(s.id))
        if (fresh.length > 0) {
          for (const s of fresh) knownSectionIdsRef.current.add(s.id)
          setExpanded((prev) => new Set([...prev, ...fresh.map((s) => s.id)]))
        }
      }
    }
    if (stale) resync()
  }, [props.sections, props.contents, queue.pending])

  // The ref is kept: Radix asks onCloseFocusTarget later (setTimeout on unmount), which consumes it.
  useEffect(() => {
    if (!pendingFocusId) return
    document.getElementById(pendingFocusId)?.focus()
    setPendingFocusId(null)
  }, [pendingFocusId])

  const takeFocusTarget = () => {
    const id = pendingFocusRef.current
    pendingFocusRef.current = null
    return id ? document.getElementById(id) : null
  }

  const focusLater = (id: string | null) => {
    pendingFocusRef.current = id
    setPendingFocusId(id)
  }

  const expand = (id: number) => setExpanded((prev) => new Set(prev).add(id))

  const reload = () =>
    router.reload({
      only: ['sections', 'contents'],
      onSuccess: trackVisit(),
      onFinish: () => queue.dismiss(),
    })

  // --- state helpers (whole arrays and id lists, so bulk actions can reuse them) ---

  const tokenOf = (ref: ItemRef) =>
    (ref.kind === 'section'
      ? sectionsRef.current.find((s) => s.id === ref.id)?.updatedAt
      : contentsRef.current.find((c) => c.id === ref.id)?.updatedAt) ?? null

  const patchItem = (ref: ItemRef, patch: ItemPatch) => {
    if (ref.kind === 'section') {
      commitSections(sectionsRef.current.map((s) => (s.id === ref.id ? { ...s, ...patch } : s)))
    } else {
      commitContents(contentsRef.current.map((c) => (c.id === ref.id ? { ...c, ...patch } : c)))
    }
  }

  const removeItems = (sectionIds: number[], contentIds: number[]) => {
    if (sectionIds.length > 0) {
      commitSections(sectionsRef.current.filter((s) => !sectionIds.includes(s.id)))
    }
    if (contentIds.length > 0) {
      commitContents(contentsRef.current.filter((c) => !contentIds.includes(c.id)))
    }
  }

  /** One optimistic op: snapshot + mutate on apply, token read at run time, snapshot restored on failure. */
  const save = (
    label: string,
    ref: ItemRef,
    mutate: () => void,
    send: (token: string | null) => Promise<Saved>,
    onError?: (error: SaveError) => void
  ) => {
    let snapshot: Snapshot = { sections: sectionsRef.current, contents: contentsRef.current }
    queue.enqueue({
      label,
      apply() {
        snapshot = { sections: sectionsRef.current, contents: contentsRef.current }
        mutate()
      },
      async run() {
        const res = await send(tokenOf(ref))
        settledRef.current++
        if (res.item.updatedAt !== undefined) patchItem(ref, { updatedAt: res.item.updatedAt })
      },
      rollback(error) {
        // A lost response may still have committed.
        settledRef.current++
        // The snapshot predates server results merged since (copies, shifted dates):
        // fetch server truth once the queue is idle; the retry list is kept.
        resyncRef.current = true
        // Tokens are server truth: an earlier op may have saved since the snapshot.
        commitSections(withCurrentTokens(snapshot.sections, sectionsRef.current))
        commitContents(withCurrentTokens(snapshot.contents, contentsRef.current))
        onError?.(error)
      },
    })
  }

  // --- actions ---

  const rename = (row: Row, value: string) => {
    const ref = refOf(row)
    setEditing(null)
    const current = row.kind === 'section' ? row.section.title : row.content.title
    if (value === current) return
    save(
      'Renommer',
      ref,
      () => patchItem(ref, { title: value }),
      (token) => sendJson('PUT', urlOf(ref), { title: value, updatedAt: token }),
      (error) => {
        if (error.kind !== 'conflict') return
        // D-09: take the fresh title and token, keep what the teacher typed.
        const fresh = (error.body as { item?: { title?: string; updatedAt?: string | null } })?.item
        if (fresh) patchItem(ref, { title: fresh.title, updatedAt: fresh.updatedAt ?? null })
        setEditing({ key: row.key, draft: value, error: error.message })
      }
    )
  }

  const saveDetails = (row: Row, patch: Partial<DetailsValues>) => {
    const ref = refOf(row)
    setPanelErrors((prev) => {
      const next = { ...prev }
      delete next[row.key]
      return next
    })
    save(
      'Détails',
      ref,
      () => patchItem(ref, patch),
      (token) => sendJson('PUT', urlOf(ref), { ...patch, updatedAt: token }),
      (error) => {
        if (error.kind === 'conflict') {
          const fresh = (error.body as { item?: { updatedAt?: string | null } })?.item
          if (fresh) patchItem(ref, { updatedAt: fresh.updatedAt ?? null })
        }
        setPanelErrors((prev) => ({ ...prev, [row.key]: error.message }))
      }
    )
  }

  const move = (row: Row, placement: Placement, focusActions = true) => {
    const ref = refOf(row)
    save(
      'Déplacer',
      ref,
      () => {
        if (ref.kind === 'content') {
          commitContents(applyContentMove(contentsRef.current, ref.id, placement))
        } else {
          commitSections(applySectionMove(sectionsRef.current, ref.id, placement))
        }
      },
      (token) =>
        sendJson(
          'POST',
          `${urlOf(ref)}/move`,
          ref.kind === 'content'
            ? { moduleId: placement.parentId, position: placement.position, updatedAt: token }
            : { parentId: placement.parentId, position: placement.position, updatedAt: token }
        )
    )
    // The destination must be open, or the moved row (and its focus target) disappears.
    if (placement.parentId !== null) expand(placement.parentId)
    if (focusActions) focusLater(`${row.key}-actions`)
  }

  /** "Déplacer vers…": the item goes to the end of the destination. */
  const moveTo = (row: Row, parentId: number | null) => {
    const position =
      row.kind === 'content'
        ? contentsRef.current.filter((c) => c.moduleId === parentId && c.id !== row.id).length
        : sectionsRef.current.filter((s) => s.parentId === parentId && s.id !== row.id).length
    move(row, { parentId, position })
  }

  const remove = (row: Row, rows: Row[]) => {
    const ref = refOf(row)
    const title = row.kind === 'section' ? row.section.title : row.content.title
    // A section goes to the trash with its whole sub-tree (D-03).
    const gone = bulkDeletedIds(sectionsRef.current, contentsRef.current, [ref])
    const goneKeys = new Set([
      ...gone.sectionIds.map((id) => rowKey({ kind: 'section', id })),
      ...gone.contentIds.map((id) => rowKey({ kind: 'content', id })),
    ])
    const index = rows.findIndex((r) => r.key === row.key)
    const neighbour =
      rows.slice(index + 1).find((r) => !goneKeys.has(r.key)) ??
      rows.slice(0, index).findLast((r) => !goneKeys.has(r.key))
    save(
      'Supprimer',
      ref,
      () => removeItems(gone.sectionIds, gone.contentIds),
      async () => {
        const res = await sendJson<Saved>('DELETE', urlOf(ref))
        offerUndo(`« ${title} » déplacé dans la corbeille.`, res.batch!, 1)
        return res
      }
    )
    focusLater(neighbour ? `${neighbour.key}-title` : null)
  }

  // --- bulk actions (05-09 endpoints, same queue and indicator as single edits) ---

  const commit = (next: Snapshot) => {
    commitSections(next.sections)
    commitContents(next.contents)
  }

  /** Items are fixed at enqueue time (tree order); tokens are read at run time. */
  const enqueueBulk = (
    label: string,
    action: 'publish' | 'availability' | 'shift' | 'move' | 'duplicate' | 'delete',
    body: Record<string, unknown>,
    optimistic?: (items: ItemRef[]) => void
  ) => {
    const items = selectedItems(sectionsRef.current, contentsRef.current, selected)
    if (items.length === 0) return
    // Trash roots of a delete, counted before its rows leave the refs.
    const roots = topLevelItems(sectionsRef.current, contentsRef.current, items).length
    let snapshot: Snapshot = { sections: sectionsRef.current, contents: contentsRef.current }
    // Optimistically deleted rows are gone from the refs: fall back to their snapshot token.
    const token = (ref: ItemRef) => {
      const find = (s: Snapshot) =>
        ref.kind === 'section'
          ? s.sections.find((x) => x.id === ref.id)
          : s.contents.find((x) => x.id === ref.id)
      const row =
        find({ sections: sectionsRef.current, contents: contentsRef.current }) ?? find(snapshot)
      return row?.updatedAt ?? null
    }
    // Duplicate and shift are not idempotent: "Réessayer" re-sends the first tokens, so a
    // replay after a lost response (server bumped them) is a 409, never a second copy or shift.
    let pinned: (ItemRef & { updatedAt: string | null })[] | null = null
    // State right after this op's optimistic step: what differs from it later is a later op's.
    let applied: Snapshot = snapshot
    queue.enqueue({
      label,
      apply() {
        snapshot = { sections: sectionsRef.current, contents: contentsRef.current }
        optimistic?.(items)
        applied = { sections: sectionsRef.current, contents: contentsRef.current }
      },
      async run() {
        const sent = pinned ?? items.map((ref) => ({ ...ref, updatedAt: token(ref) }))
        if (action === 'duplicate' || action === 'shift') pinned = sent
        const result = await sendJson<BulkResult & { batch?: string }>(
          'POST',
          `/courses/${course.id}/builder/bulk/${action}`,
          { ...body, items: sent }
        )
        settledRef.current++
        commit(
          mergeBulkResult(
            { sections: sectionsRef.current, contents: contentsRef.current },
            result,
            snapshot,
            applied
          )
        )
        // Duplicated sections open like freshly created ones.
        const fresh = sectionsRef.current.filter((s) => !knownSectionIdsRef.current.has(s.id))
        if (fresh.length > 0) {
          for (const s of fresh) knownSectionIdsRef.current.add(s.id)
          setExpanded((prev) => new Set([...prev, ...fresh.map((s) => s.id)]))
        }
        if (action === 'delete') {
          const text = `${elements(roots)} déplacé${roots > 1 ? 's' : ''} dans la corbeille.`
          offerUndo(text, result.batch!, roots)
        }
      },
      rollback() {
        settledRef.current++
        resyncRef.current = true // see save()
        // Tokens are server truth: an earlier op may have saved since the snapshot.
        commitSections(withCurrentTokens(snapshot.sections, sectionsRef.current))
        commitContents(withCurrentTokens(snapshot.contents, contentsRef.current))
      },
    })
  }

  /** D-18: neutral toast (richColors would make a success toast compete with the action). */
  const offerUndo = (message: string, batch: string, roots: number) => {
    setTrashCount((n) => n + roots)
    toast(message, {
      duration: 10_000,
      action: { label: 'Annuler', onClick: () => undo(batch, roots) },
    })
  }

  /** A queue op, so it runs after pending writes and shows in the save status. */
  const undo = (batch: string, roots: number) => {
    let snapshot: Snapshot = { sections: sectionsRef.current, contents: contentsRef.current }
    queue.enqueue({
      label: 'Restaurer',
      apply() {
        snapshot = { sections: sectionsRef.current, contents: contentsRef.current }
      },
      async run() {
        let result: BulkResult
        try {
          result = await sendJson<BulkResult>('POST', `/courses/${course.id}/trash/restore-batch`, {
            batch,
          })
        } catch (e) {
          // Nothing was restored and a retry cannot help: report it, keep it off the retry list.
          const code = ((e as SaveError).body as { code?: string } | null)?.code
          if (code === 'E_PARENT_TRASHED') {
            toast.error(
              "Restauration impossible : la section a été supprimée. L'élément reste dans la corbeille."
            )
          } else if (code === 'E_NOT_IN_TRASH') {
            toast.error("Cet élément n'est plus dans la corbeille.")
          } else throw e
          settledRef.current++
          return
        }
        settledRef.current++
        const before = new Set(sectionsRef.current.map((s) => s.id))
        // Restored rows are absent from the snapshot: they arrive through the "added" branch.
        commit(
          mergeBulkResult(
            { sections: sectionsRef.current, contents: contentsRef.current },
            result,
            snapshot,
            snapshot
          )
        )
        const restored = sectionsRef.current.filter((s) => !before.has(s.id)).map((s) => s.id)
        if (restored.length > 0) setExpanded((prev) => new Set([...prev, ...restored]))
        setTrashCount((n) => Math.max(0, n - roots))
        toast.success('Restauration effectuée.')
      },
      rollback() {
        settledRef.current++
        resyncRef.current = true // see save()
      },
    })
  }

  const patchSelection = (patch: Parameters<typeof applyBulkPatch>[3]) => (items: ItemRef[]) =>
    commit(applyBulkPatch(sectionsRef.current, contentsRef.current, items, patch))

  const bulk = {
    publish: (isPublished: boolean) =>
      enqueueBulk(
        isPublished ? 'Publier' : 'Dépublier',
        'publish',
        { isPublished },
        patchSelection({ isPublished })
      ),
    availability: (v: { availableFrom: string | null; availableUntil: string | null }) =>
      enqueueBulk('Disponibilité', 'availability', v, patchSelection(v)),
    shift: (v: { days: number } | { from: string; to: string }) =>
      enqueueBulk('Décaler les dates', 'shift', v),
    move: (parentId: number | null) => {
      enqueueBulk('Déplacer', 'move', { parentId }, (items) =>
        commit(applyBulkMove(sectionsRef.current, contentsRef.current, items, parentId))
      )
      if (parentId !== null) expand(parentId)
    },
    duplicate: () => enqueueBulk('Dupliquer', 'duplicate', {}),
    // Focus then goes to the master checkbox (bulk-action-bar's dialog close handler).
    remove: () =>
      enqueueBulk('Supprimer', 'delete', {}, (items) => {
        const ids = bulkDeletedIds(sectionsRef.current, contentsRef.current, items)
        removeItems(ids.sectionIds, ids.contentIds)
      }),
  }

  // --- creation (Inertia forms, unchanged endpoints) ---

  const [isModuleDialogOpen, setIsModuleDialogOpen] = useState(false)
  const [isContentDialogOpen, setIsContentDialogOpen] = useState(false)
  const [selectedModuleId, setSelectedModuleId] = useState<number | null>(null)

  const moduleForm = useForm({
    courseId: course.id,
    parentId: null as number | null,
    title: '',
    description: '',
    isPublished: true,
  })

  const contentForm = useForm({
    moduleId: 0,
    contentType: 'page' as ContentType,
    title: '',
    description: '',
    content: '',
    externalUrl: '',
    isPublished: true,
  })

  const handleCreateModule = (parentId: number | null = null) => {
    moduleForm.setData({ ...moduleForm.data, courseId: course.id, parentId })
    setIsModuleDialogOpen(true)
  }

  const handleCreateContent = (moduleId: number) => {
    setSelectedModuleId(moduleId)
    expand(moduleId)
    contentForm.setData({ ...contentForm.data, moduleId })
    setIsContentDialogOpen(true)
  }

  // preserveState keeps this component mounted, so expansion and the save queue survive.
  const submitModule = (e: React.FormEvent) => {
    e.preventDefault()
    const track = trackVisit()
    moduleForm.post(`/courses/${course.id}/modules`, {
      preserveScroll: true,
      preserveState: true,
      onSuccess: () => {
        track()
        setIsModuleDialogOpen(false)
        moduleForm.reset()
      },
    })
  }

  const submitContent = (e: React.FormEvent) => {
    e.preventDefault()
    const track = trackVisit()
    contentForm.post(`/modules/${selectedModuleId}/contents`, {
      preserveScroll: true,
      preserveState: true,
      onSuccess: () => {
        track()
        setIsContentDialogOpen(false)
        contentForm.reset()
      },
    })
  }

  // --- rows and drag ---

  const rows = buildRows(sections, contents, expanded)

  // DragOverlay portals into document.body, which only exists after hydration.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const [projectedDepth, setProjectedDepth] = useState<number | undefined>(undefined)
  const activeRow = activeKey ? rows.find((r) => r.key === activeKey) : undefined
  // A dragged section moves among sections only, without its own sub-tree.
  const dragRows = activeKey?.startsWith('s-') ? sectionRowsForDrag(rows, activeKey) : rows
  const depthOffsetRef = useRef(0)
  const projectionRef = useRef<Projection>(null)
  const depthChangedRef = useRef(false)
  const expandTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: builderKeyboardCoordinates })
  )

  const titleOf = (key: string) => {
    const r = rows.find((x) => x.key === key)
    return r ? (r.kind === 'section' ? r.section.title : r.content.title) : ''
  }
  const placeOf = (p: Placement) =>
    `« ${p.parentId === null ? ROOT_LABEL : (sections.find((s) => s.id === p.parentId)?.title ?? '')} », position ${p.position + 1}`

  const project = (key: string, overKey: string | null): Projection => {
    if (!overKey) return null
    return key.startsWith('s-')
      ? projectSectionDrop(dragRows, key, overKey, depthOffsetRef.current, sections)
      : projectContentDrop(dragRows, key, overKey)
  }

  const refresh = (key: string, overKey: string | null) => {
    const next = project(key, overKey)
    depthChangedRef.current = next?.depth !== projectionRef.current?.depth
    projectionRef.current = next
    if (key.startsWith('s-')) setProjectedDepth(next?.depth)
  }

  /** Index among the row's siblings, the same meaning as a Placement position. */
  const currentPlacement = (row: Row): Placement => ({
    parentId: row.parentId,
    position: rows
      .filter((r) => r.kind === row.kind && r.parentId === row.parentId)
      .findIndex((r) => r.key === row.key),
  })

  const endDrag = () => {
    clearTimeout(expandTimerRef.current)
    depthOffsetRef.current = 0
    setActiveKey(null)
    setProjectedDepth(undefined)
  }

  const onDragStart = ({ active }: DragStartEvent) => {
    depthOffsetRef.current = 0
    projectionRef.current = null
    setActiveKey(String(active.id))
  }

  const onDragMove = ({ active, over, delta }: DragMoveEvent) => {
    depthOffsetRef.current = Math.round(delta.x / INDENT_PX)
    refresh(String(active.id), over ? String(over.id) : null)
  }

  const onDragOver = ({ active, over }: DragOverEvent) => {
    clearTimeout(expandTimerRef.current)
    const target = over ? rows.find((r) => r.key === over.id) : undefined
    // D-03: a collapsed section opens after a short hover so a content can land inside it.
    if (String(active.id).startsWith('c-') && target?.kind === 'section' && target.collapsed) {
      expandTimerRef.current = setTimeout(() => expand(target.id), 600)
    }
    refresh(String(active.id), over ? String(over.id) : null)
  }

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    const key = String(active.id)
    const projection = project(key, over ? String(over.id) : null)
    projectionRef.current = projection
    endDrag()
    const row = rows.find((r) => r.key === key)
    if (!row || !projection) return
    const current = currentPlacement(row)
    if (current.parentId === projection.parentId && current.position === projection.position) return
    // Same save path as the menu; focus stays on the handle (dnd-kit restoreFocus).
    move(row, { parentId: projection.parentId, position: projection.position }, false)
  }

  const announcements: Announcements = {
    onDragStart: ({ active }) => `« ${titleOf(String(active.id))} » saisi.`,
    onDragMove: () =>
      depthChangedRef.current
        ? projectionRef.current
          ? `Sera déposé dans ${placeOf(projectionRef.current)}.`
          : 'Emplacement impossible ici.'
        : undefined,
    // At pick-up `over` is the row itself: keep "saisi." audible instead of the unchanged slot.
    onDragOver: ({ active, over }) =>
      over?.id === active.id && depthOffsetRef.current === 0
        ? undefined
        : projectionRef.current
          ? `Sera déposé dans ${placeOf(projectionRef.current)}.`
          : 'Emplacement impossible ici.',
    onDragEnd: ({ active }) => {
      const key = String(active.id)
      if (projectionRef.current) {
        return `« ${titleOf(key)} » déposé dans ${placeOf(projectionRef.current)}.`
      }
      return key.startsWith('s-')
        ? 'Déplacement impossible : profondeur maximale de 2 niveaux.'
        : 'Déplacement impossible : un contenu doit rester dans une section.'
    },
    onDragCancel: ({ active }) =>
      `Déplacement annulé. « ${titleOf(String(active.id))} » est revenu à sa place.`,
  }

  function rowProps(row: Row): BuilderRowProps {
    const ref = refOf(row)
    const up = siblingPlacement(sections, contents, ref, 'up')
    const down = siblingPlacement(sections, contents, ref, 'down')
    const isEditing = editing?.key === row.key
    const parentTitle = sections.find((s) => s.id === row.parentId)?.title ?? ''
    const hasDescendants =
      row.kind === 'section' &&
      (sections.some((s) => s.parentId === row.id) || contents.some((c) => c.moduleId === row.id))
    // Learner impact over every content of the sub-tree (D-19).
    const impactIds =
      row.kind === 'content'
        ? [row.id]
        : hasDescendants
          ? bulkDeletedIds(sections, contents, [ref]).contentIds
          : []
    return {
      row,
      location:
        row.kind === 'content'
          ? `dans la section « ${parentTitle} »`
          : row.parentId === null
            ? 'section de niveau 1'
            : `sous-section de « ${parentTitle} », niveau ${row.depth + 1}`,
      expanded: row.kind === 'section' ? expanded.has(row.id) : undefined,
      onToggleExpanded: () =>
        setExpanded((prev) => {
          const next = new Set(prev)
          if (next.has(row.id)) next.delete(row.id)
          else next.add(row.id)
          return next
        }),
      editing: isEditing,
      initialDraft: isEditing ? editing?.draft : undefined,
      titleError: isEditing ? (editing?.error ?? null) : null,
      onStartEdit: () => setEditing({ key: row.key }),
      onCancelEdit: () => setEditing(null),
      onSubmitTitle: (value) => rename(row, value),
      panelOpen: openPanels.has(row.key),
      onTogglePanel: () =>
        setOpenPanels((prev) => {
          const next = new Set(prev)
          if (next.has(row.key)) next.delete(row.key)
          else next.add(row.key)
          return next
        }),
      panelError: panelErrors[row.key] ?? null,
      onSavePanel: (patch) => saveDetails(row, patch),
      canMoveUp: up !== null,
      canMoveDown: down !== null,
      onMoveUp: () => up && move(row, up),
      onMoveDown: () => down && move(row, down),
      moveTargets: moveTargets(sections, contents, ref),
      onMoveTo: (parentId) => moveTo(row, parentId),
      hasDescendants,
      retentionDays,
      onDelete: () => remove(row, rows),
      loadLearnerImpact: impactIds.length > 0 ? () => learnerImpact(impactIds) : undefined,
      onCloseFocusTarget: () => takeFocusTarget(),
      onAddContent: row.kind === 'section' ? () => handleCreateContent(row.id) : undefined,
      onAddSubSection: row.kind === 'section' ? () => handleCreateModule(row.id) : undefined,
      projectedDepth: row.key === activeKey ? projectedDepth : undefined,
      selected: selected.has(row.key),
      onToggleSelect: () =>
        setSelected((prev) => {
          const next = new Set(prev)
          if (next.has(row.key)) next.delete(row.key)
          else next.add(row.key)
          return next
        }),
    }
  }

  const learnerImpact = (contentIds: number[]) =>
    sendJson<{ learners: number }>('POST', `/courses/${course.id}/builder/delete-impact`, {
      contentIds,
    }).then((r) => r.learners)

  const selection = selected.size > 0 ? selectedItems(sections, contents, selected) : []

  return (
    <>
      <Head title={`Éditeur - ${course.title}`} />

      <AppHeader user={auth.user} appSettings={appSettings} menus={menus} />

      <div className="container mx-auto py-8 px-4">
        <div className="flex justify-between items-center mb-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Link href={`/courses/${course.id}`}>
                <Button variant="ghost" size="sm">
                  ← Retour au cours
                </Button>
              </Link>
            </div>
            <h1 className="text-3xl font-bold">{course.title}</h1>
            <p className="text-muted-foreground mt-2">Éditeur de contenu</p>
          </div>

          <div className="flex items-center gap-2">
            <div id="save-status">
              <SaveStatus state={queue} onRetry={queue.retry} onReload={reload} />
            </div>
            <Link href={`/courses/${course.id}/trash`}>
              <Button variant="outline">
                <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                {trashCount > 0 ? `Corbeille (${trashCount})` : 'Corbeille'}
              </Button>
            </Link>
            <Link href={`/courses/${course.id}/learn`}>
              <Button variant="outline">
                <Eye className="mr-2 h-4 w-4" />
                Aperçu
              </Button>
            </Link>
            <Button onClick={() => handleCreateModule()}>
              <Plus className="mr-2 h-4 w-4" />
              Nouveau module
            </Button>
          </div>
        </div>

        {sections.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Aucun contenu</h3>
              <p className="text-muted-foreground mb-4">
                Commencez par créer un module pour organiser votre contenu
              </p>
              <Button onClick={() => handleCreateModule()}>
                <Plus className="mr-2 h-4 w-4" />
                Créer le premier module
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <SelectionControls
              total={sections.length + contents.length}
              selectedCount={selected.size}
              onSelectAll={() => setSelected(quickSelect(sections, contents, 'all'))}
              onClear={() => setSelected(new Set())}
              onQuickSelect={(q) => setSelected(quickSelect(sections, contents, q))}
            />
            {selected.size > 0 && (
              <BulkActionBar
                count={selected.size}
                retentionDays={retentionDays}
                moveTargets={bulkMoveTargets(sections, contents, selection)}
                onPublish={() => bulk.publish(true)}
                onUnpublish={() => bulk.publish(false)}
                onAvailability={bulk.availability}
                onShift={bulk.shift}
                onMove={bulk.move}
                onDuplicate={bulk.duplicate}
                onDelete={bulk.remove}
                loadLearnerImpact={() =>
                  learnerImpact(bulkDeletedIds(sections, contents, selection).contentIds)
                }
                onClear={() => setSelected(new Set())}
              />
            )}
            <DndContext
              id="course-builder"
              sensors={sensors}
              collisionDetection={closestCenter}
              measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
              accessibility={{
                announcements,
                screenReaderInstructions: { draggable: DRAG_INSTRUCTIONS },
              }}
              onDragStart={onDragStart}
              onDragMove={onDragMove}
              onDragOver={onDragOver}
              onDragEnd={onDragEnd}
              onDragCancel={endDrag}
            >
              <SortableContext
                items={dragRows.map((r) => r.key)}
                strategy={verticalListSortingStrategy}
              >
                <ul aria-label="Plan du cours">
                  {dragRows.map((row) => (
                    <BuilderRow key={row.key} {...rowProps(row)} />
                  ))}
                </ul>
              </SortableContext>
              {mounted &&
                createPortal(
                  <DragOverlay>
                    {activeRow && (
                      <div className="rounded-lg border bg-card p-3 font-medium shadow-lg">
                        {activeRow.kind === 'section'
                          ? activeRow.section.title
                          : activeRow.content.title}
                      </div>
                    )}
                  </DragOverlay>,
                  document.body
                )}
            </DndContext>
          </>
        )}
      </div>

      {/* Create Module Dialog */}
      <Dialog open={isModuleDialogOpen} onOpenChange={setIsModuleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouveau module</DialogTitle>
            <DialogDescription>
              Créez un nouveau module pour organiser votre contenu de cours
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={submitModule}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">Titre *</Label>
                <Input
                  id="title"
                  value={moduleForm.data.title}
                  onChange={(e) => moduleForm.setData('title', e.target.value)}
                  required
                />
                {moduleForm.errors.title && (
                  <p className="text-sm text-red-500">{moduleForm.errors.title}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={moduleForm.data.description}
                  onChange={(e) => moduleForm.setData('description', e.target.value)}
                  rows={3}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="isPublished"
                  checked={moduleForm.data.isPublished}
                  onCheckedChange={(checked) => moduleForm.setData('isPublished', checked)}
                />
                <Label htmlFor="isPublished">Publier immédiatement</Label>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsModuleDialogOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={moduleForm.processing}>
                Créer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create Content Dialog */}
      <Dialog open={isContentDialogOpen} onOpenChange={setIsContentDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nouveau contenu</DialogTitle>
            <DialogDescription>Ajoutez du contenu à votre module</DialogDescription>
          </DialogHeader>

          <form onSubmit={submitContent}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="contentType">Type de contenu *</Label>
                <Select
                  value={contentForm.data.contentType}
                  onValueChange={(value: ContentType) => contentForm.setData('contentType', value)}
                >
                  <SelectTrigger id="contentType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="page">Page de texte</SelectItem>
                    <SelectItem value="video">Vidéo</SelectItem>
                    <SelectItem value="file">Fichier</SelectItem>
                    <SelectItem value="link">Lien externe</SelectItem>
                    <SelectItem value="assignment">Devoir</SelectItem>
                    <SelectItem value="quiz">Quiz</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="contentTitle">Titre *</Label>
                <Input
                  id="contentTitle"
                  value={contentForm.data.title}
                  onChange={(e) => contentForm.setData('title', e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contentDescription">Description</Label>
                <Textarea
                  id="contentDescription"
                  value={contentForm.data.description}
                  onChange={(e) => contentForm.setData('description', e.target.value)}
                  rows={2}
                />
              </div>

              {contentForm.data.contentType === 'page' && (
                <div className="space-y-2">
                  <Label htmlFor="content">Contenu</Label>
                  <Textarea
                    id="content"
                    value={contentForm.data.content}
                    onChange={(e) => contentForm.setData('content', e.target.value)}
                    rows={6}
                    placeholder="Contenu HTML ou texte..."
                  />
                </div>
              )}

              {(contentForm.data.contentType === 'video' ||
                contentForm.data.contentType === 'link') && (
                <div className="space-y-2">
                  <Label htmlFor="externalUrl">URL *</Label>
                  <Input
                    id="externalUrl"
                    type="url"
                    value={contentForm.data.externalUrl}
                    onChange={(e) => contentForm.setData('externalUrl', e.target.value)}
                    placeholder="https://..."
                  />
                </div>
              )}

              <div className="flex items-center space-x-2">
                <Switch
                  id="contentIsPublished"
                  checked={contentForm.data.isPublished}
                  onCheckedChange={(checked) => contentForm.setData('isPublished', checked)}
                />
                <Label htmlFor="contentIsPublished">Publier immédiatement</Label>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsContentDialogOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={contentForm.processing}>
                Créer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
